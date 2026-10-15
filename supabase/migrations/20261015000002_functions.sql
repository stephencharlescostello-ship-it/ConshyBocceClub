-- CBC Shuffle — helpers, triggers and RPCs (server-side validation for every multi-row write)

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_player_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.players where user_id = auth.uid() and deleted_at is null limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.players where user_id = auth.uid() and deleted_at is null), false)
$$;

create or replace function public.is_member_of(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_memberships tm
    join public.players p on p.id = tm.player_id
    where tm.team_id = p_team and p.user_id = auth.uid()
  )
$$;

create or replace function public.is_captain_of(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_memberships tm
    join public.players p on p.id = tm.player_id
    where tm.team_id = p_team and tm.role = 'captain' and p.user_id = auth.uid()
  )
$$;

create or replace function public.can_score_match(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.matches m
    where m.id = p_match and (
      public.is_captain_of(m.home_team_id) or public.is_captain_of(m.away_team_id)
      or m.scorekeeper_player_id = public.current_player_id()
    )
  )
$$;

create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bans b join public.players p on p.id = b.player_id where p.user_id = auth.uid())
$$;

create or replace function public.is_muted() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mutes m join public.players p on p.id = m.player_id where p.user_id = auth.uid() and m.until > now())
$$;

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id uuid, p_before jsonb, p_after jsonb, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, actor_user_id, action, entity, entity_id, before, after, note)
  values (public.current_player_id(), auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after, p_note);
end $$;

-- 6-char code, unambiguous alphabet (no 0/O/1/I)
create or replace function public.generate_join_code() returns text
language plpgsql volatile as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text := ''; i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.team_secrets where join_code = code);
  end loop;
  return code;
end $$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- New auth user → player row (links to an imported roster row with the same email when present)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare existing uuid; nm text;
begin
  nm := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email, new.phone, 'player'), '@', 1));
  select id into existing from public.players where user_id is null and email is not null and new.email is not null and email = new.email::extensions.citext limit 1;
  if existing is not null then
    update public.players set user_id = new.id, phone = coalesce(phone, new.phone) where id = existing;
  else
    insert into public.players (user_id, display_name, email, phone) values (new.id, nm, new.email, new.phone);
  end if;
  insert into public.notification_prefs (player_id) select id from public.players where user_id = new.id on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.ensure_team_secret() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.team_secrets (team_id, join_code) values (new.id, public.generate_join_code()) on conflict do nothing;
  return new;
end $$;
create trigger teams_secret after insert on public.teams for each row execute function public.ensure_team_secret();

create or replace function public.ensure_night_channel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.channels (season_id, kind, slug, name, night_id)
  values (new.season_id, 'night', new.slug, '#' || new.slug, new.id) on conflict do nothing;
  return new;
end $$;
create trigger nights_channel after insert on public.league_nights for each row execute function public.ensure_night_channel();

create or replace function public.ensure_league_channel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.channels (season_id, kind, slug, name, rules)
  values (new.id, 'league', 'league', '#league', 'Keep it fun. Trash talk yes, slurs never. Admins can mute or ban.') on conflict do nothing;
  return new;
end $$;
create trigger seasons_channel after insert on public.seasons for each row execute function public.ensure_league_channel();

create or replace function public.ensure_match_channel() returns trigger
language plpgsql security definer set search_path = public as $$
declare hn text; an text; wk int;
begin
  if new.away_team_id is null or new.home_team_id is null then return new; end if;
  select name into hn from public.teams where id = new.home_team_id;
  select name into an from public.teams where id = new.away_team_id;
  select number into wk from public.weeks where id = new.week_id;
  insert into public.channels (season_id, kind, slug, name, night_id, match_id)
  values (new.season_id, 'match', 'match-' || left(new.id::text, 8), hn || ' vs ' || an || ' · Wk ' || coalesce(wk::text,'?'), new.night_id, new.id)
  on conflict do nothing;
  return new;
end $$;
create trigger matches_channel after insert on public.matches for each row execute function public.ensure_match_channel();

create or replace function public.audit_match_changes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (
      old.status is distinct from new.status or old.home_games is distinct from new.home_games or old.away_games is distinct from new.away_games
      or old.home_points is distinct from new.home_points or old.away_points is distinct from new.away_points
      or old.winner_team_id is distinct from new.winner_team_id or old.scheduled_at is distinct from new.scheduled_at
      or old.table_id is distinct from new.table_id or old.forfeit_team_id is distinct from new.forfeit_team_id) then
    perform public.log_audit('match.update', 'match', new.id,
      jsonb_build_object('status', old.status, 'home_games', old.home_games, 'away_games', old.away_games, 'home_points', old.home_points, 'away_points', old.away_points, 'winner_team_id', old.winner_team_id, 'scheduled_at', old.scheduled_at, 'table_id', old.table_id, 'forfeit_team_id', old.forfeit_team_id),
      jsonb_build_object('status', new.status, 'home_games', new.home_games, 'away_games', new.away_games, 'home_points', new.home_points, 'away_points', new.away_points, 'winner_team_id', new.winner_team_id, 'scheduled_at', new.scheduled_at, 'table_id', new.table_id, 'forfeit_team_id', new.forfeit_team_id));
    new.version := old.version + 1;
  elsif tg_op = 'DELETE' then
    perform public.log_audit('match.delete', 'match', old.id, to_jsonb(old), null);
    return old;
  end if;
  return new;
end $$;
create trigger matches_audit before update or delete on public.matches for each row execute function public.audit_match_changes();

-- ---------------------------------------------------------------------------
-- Format helpers
-- ---------------------------------------------------------------------------
create or replace function public.match_format(p_match uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select s.format from public.matches m join public.seasons s on s.id = m.season_id where m.id = p_match
$$;

-- Is a game over under the format? (target, optional win-by-two)
create or replace function public.game_is_over(p_home int, p_away int, p_format jsonb) returns boolean
language sql immutable as $$
  select case
    when coalesce((p_format->>'win_by_two')::boolean, false)
      then greatest(p_home, p_away) >= (p_format->>'target_score')::int and abs(p_home - p_away) >= 2
    else greatest(p_home, p_away) >= (p_format->>'target_score')::int
  end
$$;

-- Validate a finished game score under the format. Raises on impossible scores.
create or replace function public.assert_valid_game(p_home int, p_away int, p_format jsonb, p_label text)
returns void language plpgsql immutable as $$
declare target int := (p_format->>'target_score')::int; wb2 boolean := coalesce((p_format->>'win_by_two')::boolean,false);
        hi int := greatest(p_home, p_away); lo int := least(p_home, p_away);
begin
  if p_home < 0 or p_away < 0 then raise exception '%: scores cannot be negative', p_label using errcode = '22023'; end if;
  if p_home = p_away then raise exception '%: a game cannot end tied', p_label using errcode = '22023'; end if;
  if not wb2 then
    if hi <> target then raise exception '%: the winner must have exactly % points', p_label, target using errcode = '22023'; end if;
    if lo >= target then raise exception '%: the loser must have fewer than % points', p_label, target using errcode = '22023'; end if;
  else
    if hi < target then raise exception '%: the winner needs at least % points', p_label, target using errcode = '22023'; end if;
    if hi - lo < 2 then raise exception '%: must win by two', p_label using errcode = '22023'; end if;
    if hi > target and hi - lo <> 2 then raise exception '%: after % the game ends at a two-point lead', p_label, target using errcode = '22023'; end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Live scoring RPCs
-- ---------------------------------------------------------------------------
create or replace function public.start_match(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  if not public.can_score_match(p_match) then raise exception 'Only a captain, the scorekeeper or an admin can score this match' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match for update;
  if m.status not in ('scheduled','live','postponed') then raise exception 'Match is % and cannot be scored', m.status using errcode = '22023'; end if;
  if m.status <> 'live' then
    update public.matches set status = 'live', current_game = 1, entry_mode = 'live' where id = p_match;
  end if;
  insert into public.games (match_id, number, status, started_at) values (p_match, 1, 'live', now()) on conflict (match_id, number) do nothing;
  return public.match_state(p_match);
end $$;

create or replace function public.match_state(p_match uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'match', (select to_jsonb(m) from public.matches m where m.id = p_match),
    'games', (select coalesce(jsonb_agg(to_jsonb(g) order by g.number), '[]'::jsonb) from public.games g where g.match_id = p_match),
    'frames', (select coalesce(jsonb_agg(to_jsonb(f) order by g.number, f.number), '[]'::jsonb) from public.frames f join public.games g on g.id = f.game_id where g.match_id = p_match),
    'format', public.match_format(p_match)
  )
$$;

-- Record one frame. Idempotent on p_frame_id. Creates the game row when the device is ahead of the server.
create or replace function public.record_frame(
  p_match uuid, p_game_number int, p_frame_id uuid, p_scoring_team uuid, p_points int, p_hangers int, p_weights jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches; g public.games; fmt jsonb; max_points int; frame_no int; home int; away int;
        needed int; w jsonb; wsum int := 0; whang int := 0; zones jsonb; hp int;
begin
  if not public.can_score_match(p_match) then raise exception 'Only a captain, the scorekeeper or an admin can score this match' using errcode = '42501'; end if;
  if exists (select 1 from public.frames where id = p_frame_id) then return public.match_state(p_match); end if;

  select * into m from public.matches where id = p_match for update;
  if m.status in ('confirmed','forfeit','bye','void','disputed','submitted') then raise exception 'Match is % and can no longer be scored', m.status using errcode = '22023'; end if;
  if m.status <> 'live' then update public.matches set status = 'live', entry_mode = 'live' where id = p_match; end if;

  fmt := (select format from public.seasons where id = m.season_id);
  hp := (fmt->>'hanger_points')::int; zones := fmt->'zones';
  max_points := (fmt->>'weights_per_side')::int * hp;
  if p_scoring_team is not null and p_scoring_team not in (m.home_team_id, m.away_team_id) then raise exception 'Scoring team is not in this match' using errcode = '22023'; end if;
  if p_points < 0 or p_points > max_points then raise exception 'A frame scores between 0 and % points', max_points using errcode = '22023'; end if;
  if p_hangers < 0 or p_hangers > (fmt->>'weights_per_side')::int then raise exception 'Too many hangers for one frame' using errcode = '22023'; end if;
  if p_hangers * hp > p_points then raise exception 'Hangers are worth % each', hp using errcode = '22023'; end if;
  if p_points > 0 and p_scoring_team is null then raise exception 'A scoring frame needs a scoring team' using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p_weights,'[]'::jsonb)) > 0 then
    if jsonb_array_length(p_weights) > (fmt->>'weights_per_side')::int then raise exception 'Too many weights in one frame' using errcode = '22023'; end if;
    for w in select * from jsonb_array_elements(p_weights) loop
      if not (zones @> jsonb_build_array(w) or w::text::int = hp) then raise exception 'Weight value % is not a zone in this format', w using errcode = '22023'; end if;
      wsum := wsum + w::text::int; if w::text::int = hp then whang := whang + 1; end if;
    end loop;
    if wsum <> p_points or whang <> p_hangers then raise exception 'Weights do not add up to the frame total' using errcode = '22023'; end if;
  end if;

  select * into g from public.games where match_id = p_match and number = p_game_number for update;
  if g.id is null then
    if p_game_number = 1 or exists (select 1 from public.games where match_id = p_match and number = p_game_number - 1 and status = 'final') then
      insert into public.games (match_id, number, status, started_at) values (p_match, p_game_number, 'live', now()) returning * into g;
      update public.matches set current_game = p_game_number where id = p_match;
    else
      raise exception 'Game % cannot start before game % is final', p_game_number, p_game_number - 1 using errcode = '22023';
    end if;
  end if;
  if g.status = 'final' then raise exception 'Game % is already final', p_game_number using errcode = '22023'; end if;
  if g.status = 'pending' then update public.games set status = 'live', started_at = now() where id = g.id; end if;

  frame_no := coalesce((select max(number) from public.frames where game_id = g.id), 0) + 1;
  insert into public.frames (id, game_id, number, scoring_team_id, points, hangers, weights, recorded_by)
  values (p_frame_id, g.id, frame_no, case when p_points > 0 then p_scoring_team else null end, p_points, p_hangers, coalesce(p_weights,'[]'::jsonb), public.current_player_id());

  home := g.home_score + case when p_scoring_team = m.home_team_id then p_points else 0 end;
  away := g.away_score + case when p_scoring_team = m.away_team_id then p_points else 0 end;
  update public.games set home_score = home, away_score = away, frame_count = frame_no where id = g.id;

  if public.game_is_over(home, away, fmt) then
    update public.games set status = 'final', ended_at = now(), winner_team_id = case when home > away then m.home_team_id else m.away_team_id end where id = g.id;
    needed := ((fmt->>'games_per_match')::int / 2) + 1;
    update public.matches set
      home_games = (select count(*) from public.games where match_id = p_match and status = 'final' and winner_team_id = m.home_team_id),
      away_games = (select count(*) from public.games where match_id = p_match and status = 'final' and winner_team_id = m.away_team_id),
      home_points = (select coalesce(sum(home_score),0) from public.games where match_id = p_match),
      away_points = (select coalesce(sum(away_score),0) from public.games where match_id = p_match)
    where id = p_match;
    select * into m from public.matches where id = p_match;
    if m.home_games < needed and m.away_games < needed then
      insert into public.games (match_id, number, status) values (p_match, p_game_number + 1, 'pending') on conflict do nothing;
      update public.matches set current_game = p_game_number + 1 where id = p_match;
    end if;
  else
    update public.matches set
      home_points = (select coalesce(sum(home_score),0) from public.games where match_id = p_match),
      away_points = (select coalesce(sum(away_score),0) from public.games where match_id = p_match)
    where id = p_match;
  end if;
  return public.match_state(p_match);
end $$;

-- Undo the most recent frame of the match (reopens the previous game when the current one is empty).
create or replace function public.undo_frame(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches; g public.games; f public.frames; fmt jsonb;
begin
  if not public.can_score_match(p_match) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match for update;
  if m.status <> 'live' then raise exception 'Only a live match can be undone' using errcode = '22023'; end if;
  fmt := (select format from public.seasons where id = m.season_id);
  -- latest frame across games
  select f.* into f from public.frames f join public.games g on g.id = f.game_id where g.match_id = p_match order by g.number desc, f.number desc limit 1;
  if f.id is null then return public.match_state(p_match); end if;
  select * into g from public.games where id = f.game_id for update;
  -- drop any later empty game
  delete from public.games where match_id = p_match and number > g.number and frame_count = 0;
  delete from public.frames where id = f.id;
  update public.games set
    home_score = home_score - case when f.scoring_team_id = m.home_team_id then f.points else 0 end,
    away_score = away_score - case when f.scoring_team_id = m.away_team_id then f.points else 0 end,
    frame_count = frame_count - 1, status = 'live', ended_at = null, winner_team_id = null
  where id = g.id;
  update public.matches set
    current_game = g.number,
    home_games = (select count(*) from public.games where match_id = p_match and status = 'final' and winner_team_id = m.home_team_id),
    away_games = (select count(*) from public.games where match_id = p_match and status = 'final' and winner_team_id = m.away_team_id),
    home_points = (select coalesce(sum(home_score),0) from public.games where match_id = p_match),
    away_points = (select coalesce(sum(away_score),0) from public.games where match_id = p_match)
  where id = p_match;
  return public.match_state(p_match);
end $$;

create or replace function public.set_game_lineup(p_match uuid, p_game_number int, p_home jsonb, p_away jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_score_match(p_match) then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.games (match_id, number, home_lineup, away_lineup) values (p_match, p_game_number, coalesce(p_home,'[]'::jsonb), coalesce(p_away,'[]'::jsonb))
  on conflict (match_id, number) do update set home_lineup = excluded.home_lineup, away_lineup = excluded.away_lineup;
end $$;

create or replace function public.set_scorekeeper(p_match uuid, p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_score_match(p_match) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.matches set scorekeeper_player_id = p_player where id = p_match;
end $$;

-- ---------------------------------------------------------------------------
-- Submit / confirm / dispute
-- ---------------------------------------------------------------------------
-- p_games: [{"home":15,"away":9}, ...]. For live-scored matches pass null to use the recorded games.
create or replace function public.submit_match_result(p_match uuid, p_games jsonb, p_entry_mode text, p_idempotency_key text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches; fmt jsonb; needed int; hg int := 0; ag int := 0; hp int := 0; ap int := 0; i int := 0; gm jsonb; h int; a int;
        me uuid := public.current_player_id(); my_team uuid; existing public.score_submissions; hours int; decided boolean := false;
begin
  select * into existing from public.score_submissions where idempotency_key = p_idempotency_key;
  if existing.id is not null then return public.match_state(existing.match_id); end if;
  if not public.can_score_match(p_match) then raise exception 'Only a captain, the scorekeeper or an admin can submit this match' using errcode = '42501'; end if;

  select * into m from public.matches where id = p_match for update;
  if m.status in ('confirmed','forfeit','bye','void') then raise exception 'Match is already %', m.status using errcode = '22023'; end if;
  if m.status = 'submitted' then raise exception 'This match was already submitted and is waiting for confirmation' using errcode = '22023'; end if;
  if m.home_team_id is null or m.away_team_id is null then raise exception 'Bye matches have no result' using errcode = '22023'; end if;
  fmt := (select format from public.seasons where id = m.season_id);
  needed := ((fmt->>'games_per_match')::int / 2) + 1;
  hours := (select auto_confirm_hours from public.seasons where id = m.season_id);
  my_team := case when public.is_captain_of(m.home_team_id) then m.home_team_id when public.is_captain_of(m.away_team_id) then m.away_team_id else null end;

  if p_games is null then
    -- use live games
    if not exists (select 1 from public.games where match_id = p_match and status = 'final') then raise exception 'No finished games to submit' using errcode = '22023'; end if;
    select count(*) filter (where winner_team_id = m.home_team_id), count(*) filter (where winner_team_id = m.away_team_id), coalesce(sum(home_score),0), coalesce(sum(away_score),0)
      into hg, ag, hp, ap from public.games where match_id = p_match and status = 'final';
    if hg < needed and ag < needed then raise exception 'The match is not over yet (first to % games)', needed using errcode = '22023'; end if;
    delete from public.games where match_id = p_match and status <> 'final';
  else
    if jsonb_typeof(p_games) <> 'array' or jsonb_array_length(p_games) = 0 then raise exception 'Enter at least one game' using errcode = '22023'; end if;
    if jsonb_array_length(p_games) > (fmt->>'games_per_match')::int then raise exception 'At most % games per match', (fmt->>'games_per_match')::int using errcode = '22023'; end if;
    -- replace games (quick entry / admin edit)
    delete from public.frames where game_id in (select id from public.games where match_id = p_match);
    delete from public.games where match_id = p_match;
    for gm in select * from jsonb_array_elements(p_games) loop
      i := i + 1;
      if decided then raise exception 'Game %: the match was already decided', i using errcode = '22023'; end if;
      h := (gm->>'home')::int; a := (gm->>'away')::int;
      perform public.assert_valid_game(h, a, fmt, 'Game ' || i);
      insert into public.games (match_id, number, home_score, away_score, status, winner_team_id, home_lineup, away_lineup)
      values (p_match, i, h, a, 'final', case when h > a then m.home_team_id else m.away_team_id end, coalesce(gm->'home_lineup','[]'::jsonb), coalesce(gm->'away_lineup','[]'::jsonb));
      if h > a then hg := hg + 1; else ag := ag + 1; end if;
      hp := hp + h; ap := ap + a;
      if hg >= needed or ag >= needed then decided := true; end if;
    end loop;
    if not decided then raise exception 'Not enough games: first to % wins the match', needed using errcode = '22023'; end if;
  end if;

  update public.matches set
    status = 'submitted', entry_mode = coalesce(p_entry_mode, m.entry_mode, 'quick'),
    home_games = hg, away_games = ag, home_points = hp, away_points = ap,
    winner_team_id = case when hg > ag then m.home_team_id else m.away_team_id end,
    submitted_by = me, submitted_at = now(), submitting_team_id = my_team,
    auto_confirm_at = case when hours = 0 then now() else now() + make_interval(hours => hours) end,
    notes = coalesce(p_note, notes)
  where id = p_match;

  insert into public.score_submissions (match_id, submitted_by, team_id, idempotency_key, payload)
  values (p_match, me, my_team, p_idempotency_key, jsonb_build_object('games', p_games, 'entry_mode', p_entry_mode, 'note', p_note));

  -- Admin submissions confirm immediately.
  if my_team is null and public.is_admin() then
    update public.matches set status = 'confirmed', confirmed_by = me, confirmed_at = now() where id = p_match;
    insert into public.confirmations (match_id, player_id, decision, note) values (p_match, me, 'confirm', 'Entered by admin');
  end if;
  return public.match_state(p_match);
end $$;

create or replace function public.confirm_match(p_match uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches; me uuid := public.current_player_id(); other uuid;
begin
  select * into m from public.matches where id = p_match for update;
  if m.status <> 'submitted' then raise exception 'Match is not waiting for confirmation' using errcode = '22023'; end if;
  other := case when m.submitting_team_id = m.home_team_id then m.away_team_id when m.submitting_team_id = m.away_team_id then m.home_team_id else null end;
  if not (public.is_admin() or (other is not null and public.is_captain_of(other))) then
    raise exception 'Only the opposing captain or an admin can confirm' using errcode = '42501';
  end if;
  update public.matches set status = 'confirmed', confirmed_by = me, confirmed_at = now() where id = p_match;
  insert into public.confirmations (match_id, team_id, player_id, decision, note) values (p_match, other, me, 'confirm', p_note);
  return public.match_state(p_match);
end $$;

create or replace function public.dispute_match(p_match uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches; me uuid := public.current_player_id(); other uuid;
begin
  select * into m from public.matches where id = p_match for update;
  if m.status <> 'submitted' then raise exception 'Match is not waiting for confirmation' using errcode = '22023'; end if;
  other := case when m.submitting_team_id = m.home_team_id then m.away_team_id else m.home_team_id end;
  if not (public.is_admin() or public.is_captain_of(other)) then raise exception 'Only the opposing captain can dispute' using errcode = '42501'; end if;
  update public.matches set status = 'disputed', auto_confirm_at = null where id = p_match;
  insert into public.confirmations (match_id, team_id, player_id, decision, note) values (p_match, other, me, 'dispute', p_note);
  insert into public.disputes (match_id, opened_by, team_id, note) values (p_match, me, other, p_note);
  return public.match_state(p_match);
end $$;

-- Admin resolves: 'uphold' (confirm as submitted), 'correct' (confirm with p_games), 'replay' (back to scheduled), 'void'
create or replace function public.resolve_dispute(p_dispute uuid, p_action text, p_games jsonb default null, p_resolution text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.disputes; m public.matches; me uuid := public.current_player_id();
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if d.status <> 'open' then raise exception 'Dispute already resolved' using errcode = '22023'; end if;
  select * into m from public.matches where id = d.match_id for update;
  if p_action = 'uphold' then
    update public.matches set status = 'confirmed', confirmed_by = me, confirmed_at = now() where id = m.id;
  elsif p_action = 'correct' then
    update public.matches set status = 'scheduled' where id = m.id;
    perform public.submit_match_result(m.id, p_games, 'admin', 'dispute-' || p_dispute::text || '-' || extract(epoch from now())::text, p_resolution);
    update public.matches set status = 'confirmed', confirmed_by = me, confirmed_at = now() where id = m.id;
  elsif p_action = 'replay' then
    delete from public.frames where game_id in (select id from public.games where match_id = m.id);
    delete from public.games where match_id = m.id;
    update public.matches set status = 'scheduled', home_games = 0, away_games = 0, home_points = 0, away_points = 0, winner_team_id = null, submitted_by = null, submitted_at = null, submitting_team_id = null, auto_confirm_at = null, current_game = 1 where id = m.id;
  elsif p_action = 'void' then
    update public.matches set status = 'void', winner_team_id = null where id = m.id;
  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end if;
  update public.disputes set status = 'resolved', resolution = coalesce(p_resolution, p_action), resolved_by = me, resolved_at = now() where id = p_dispute;
  perform public.log_audit('dispute.resolve', 'match', m.id, jsonb_build_object('dispute', p_dispute), jsonb_build_object('action', p_action, 'resolution', p_resolution));
  return public.match_state(m.id);
end $$;

-- Called by cron and lazily by the app. Returns ids of newly confirmed matches.
create or replace function public.auto_confirm_due() returns uuid[]
language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  with due as (
    update public.matches set status = 'confirmed', confirmed_at = now()
    where status = 'submitted' and auto_confirm_at is not null and auto_confirm_at <= now()
    returning id
  ), c as (
    insert into public.confirmations (match_id, decision, note) select id, 'auto', 'Auto-confirmed after the confirmation window' from due returning match_id
  )
  select coalesce(array_agg(match_id), '{}') into ids from c;
  return ids;
end $$;

-- Admin: forfeit, postpone, reschedule, override
create or replace function public.set_forfeit(p_match uuid, p_forfeiting_team uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches; fmt jsonb; needed int; target int; winner uuid; me uuid := public.current_player_id();
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match for update;
  if p_forfeiting_team not in (m.home_team_id, m.away_team_id) then raise exception 'Team not in match' using errcode = '22023'; end if;
  fmt := (select format from public.seasons where id = m.season_id);
  needed := ((fmt->>'games_per_match')::int / 2) + 1; target := (fmt->>'target_score')::int;
  winner := case when p_forfeiting_team = m.home_team_id then m.away_team_id else m.home_team_id end;
  delete from public.frames where game_id in (select id from public.games where match_id = p_match);
  delete from public.games where match_id = p_match;
  update public.matches set status = 'forfeit', forfeit_team_id = p_forfeiting_team, winner_team_id = winner, entry_mode = 'admin',
    home_games = case when winner = m.home_team_id then needed else 0 end, away_games = case when winner = m.away_team_id then needed else 0 end,
    home_points = case when winner = m.home_team_id then needed * target else 0 end, away_points = case when winner = m.away_team_id then needed * target else 0 end,
    confirmed_by = me, confirmed_at = now(), notes = coalesce(p_note, notes)
  where id = p_match;
  return public.match_state(p_match);
end $$;

create or replace function public.postpone_match(p_match uuid, p_new_at timestamptz default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select * into m from public.matches where id = p_match for update;
  if m.status in ('confirmed','forfeit','void') then raise exception 'Cannot postpone a finished match' using errcode = '22023'; end if;
  if p_new_at is null then
    update public.matches set status = 'postponed', postponed_from = coalesce(postponed_from, scheduled_at), notes = coalesce(p_note, notes) where id = p_match;
  else
    update public.matches set status = 'scheduled', postponed_from = coalesce(postponed_from, scheduled_at), scheduled_at = p_new_at, is_makeup = true, notes = coalesce(p_note, notes) where id = p_match;
  end if;
  return public.match_state(p_match);
end $$;

create or replace function public.admin_reset_match(p_match uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  delete from public.frames where game_id in (select id from public.games where match_id = p_match);
  delete from public.games where match_id = p_match;
  update public.matches set status = 'scheduled', home_games = 0, away_games = 0, home_points = 0, away_points = 0, winner_team_id = null, forfeit_team_id = null,
    submitted_by = null, submitted_at = null, submitting_team_id = null, confirmed_by = null, confirmed_at = null, auto_confirm_at = null, current_game = 1, entry_mode = null, notes = coalesce(p_note, notes)
  where id = p_match;
  perform public.log_audit('match.reset', 'match', p_match, null, null, p_note);
  return public.match_state(p_match);
end $$;

-- ---------------------------------------------------------------------------
-- Joining teams
-- ---------------------------------------------------------------------------
create or replace function public.join_team_with_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid; me uuid := public.current_player_id();
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select team_id into t from public.team_secrets where join_code = upper(trim(p_code));
  if t is null then raise exception 'That join code was not found' using errcode = '22023'; end if;
  insert into public.team_memberships (team_id, player_id, role) values (t, me, 'player') on conflict (team_id, player_id) do nothing;
  return t;
end $$;

-- Claim an imported roster entry (a player row with no account). Merges it into the caller's player row.
create or replace function public.claim_roster_player(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_player_id(); target public.players;
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into target from public.players where id = p_player for update;
  if target.id is null or target.user_id is not null then raise exception 'That roster spot is already claimed' using errcode = '22023'; end if;
  update public.team_memberships set player_id = me where player_id = p_player and team_id not in (select team_id from public.team_memberships where player_id = me);
  delete from public.team_memberships where player_id = p_player;
  update public.frames set recorded_by = me where recorded_by = p_player;
  update public.player_badges set player_id = me where player_id = p_player and badge_slug not in (select badge_slug from public.player_badges where player_id = me);
  update public.awards set player_id = me where player_id = p_player;
  update public.dues set player_id = me where player_id = p_player and season_id not in (select season_id from public.dues where player_id = me);
  update public.messages set author_id = me where author_id = p_player;
  update public.players set display_name = coalesce(nullif((select display_name from public.players where id = me), ''), target.display_name), nickname = coalesce(nickname, target.nickname) where id = me;
  update public.players set deleted_at = now(), display_name = display_name || ' (merged)' where id = p_player;
end $$;

create or replace function public.rotate_join_code(p_team uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not (public.is_admin() or public.is_captain_of(p_team)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  code := public.generate_join_code();
  update public.team_secrets set join_code = code, rotated_at = now() where team_id = p_team;
  return code;
end $$;

-- ---------------------------------------------------------------------------
-- Chat RPCs: rate limiting, word filter, mentions
-- ---------------------------------------------------------------------------
create or replace function public.contains_blocked_word(p_text text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare w text; norm text;
begin
  -- normalise common substitutions so "f@g" style evasions still match
  norm := lower(translate(p_text, '@$013457!|', 'asoieasti ')); -- @→a $→s 0→o 1→i 3→e 4→a 5→s 7→t !→i |→(space)
  for w in select word from public.blocked_words loop
    if norm ~* ('(^|[^a-z])' || regexp_replace(lower(w), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '([^a-z]|$)') then return true; end if;
  end loop;
  return false;
end $$;

create or replace function public.post_message(p_channel uuid, p_body text, p_reply_to uuid default null, p_photo_url text default null, p_gif_url text default null, p_client_id text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_player_id(); msg public.messages; body text := coalesce(trim(p_body), ''); mentioned uuid[]; recent int; burst int;
begin
  if me is null then raise exception 'Sign in to chat' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Your account is banned from chat' using errcode = '42501'; end if;
  if public.is_muted() then raise exception 'You are muted right now' using errcode = '42501'; end if;
  if p_client_id is not null then
    select * into msg from public.messages where client_id = p_client_id;
    if msg.id is not null then return to_jsonb(msg); end if;
  end if;
  if body = '' and p_photo_url is null and p_gif_url is null then raise exception 'Say something first' using errcode = '22023'; end if;
  if length(body) > 2000 then raise exception 'Keep it under 2000 characters' using errcode = '22023'; end if;
  if public.contains_blocked_word(body) then raise exception 'That message contains a blocked word' using errcode = '22023'; end if;
  select count(*) into burst from public.messages where author_id = me and created_at > now() - interval '2 seconds';
  select count(*) into recent from public.messages where author_id = me and created_at > now() - interval '1 minute';
  if burst > 0 or recent >= 20 then raise exception 'Slow down a little' using errcode = '22023'; end if;
  -- @mentions: match "@Display Name" or "@nickname" (longest names first)
  select coalesce(array_agg(p.id), '{}') into mentioned from public.players p
    where p.deleted_at is null and p.user_id is not null and (
      position(lower('@' || p.display_name) in lower(body)) > 0 or (p.nickname is not null and position(lower('@' || p.nickname) in lower(body)) > 0)
    );
  insert into public.messages (channel_id, author_id, body, reply_to, photo_url, gif_url, mentions, client_id)
  values (p_channel, me, body, p_reply_to, p_photo_url, p_gif_url, mentioned, p_client_id) returning * into msg;
  insert into public.channel_reads (channel_id, player_id, last_read_at) values (p_channel, me, now()) on conflict (channel_id, player_id) do update set last_read_at = now();
  return to_jsonb(msg);
end $$;

create or replace function public.edit_message(p_message uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare msg public.messages; me uuid := public.current_player_id();
begin
  select * into msg from public.messages where id = p_message for update;
  if msg.author_id <> me then raise exception 'Not your message' using errcode = '42501'; end if;
  if msg.created_at < now() - interval '5 minutes' then raise exception 'The 5-minute edit window has passed' using errcode = '22023'; end if;
  if public.contains_blocked_word(p_body) then raise exception 'That message contains a blocked word' using errcode = '22023'; end if;
  update public.messages set body = trim(p_body), edited_at = now() where id = p_message;
end $$;

create or replace function public.delete_message(p_message uuid) returns void
language plpgsql security definer set search_path = public as $$
declare msg public.messages; me uuid := public.current_player_id();
begin
  select * into msg from public.messages where id = p_message for update;
  if not (msg.author_id = me or public.is_admin()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.messages set deleted_at = now(), deleted_by = me, body = '', photo_url = null, gif_url = null where id = p_message;
  if msg.author_id <> me then perform public.log_audit('message.delete', 'message', p_message, jsonb_build_object('body', msg.body, 'author', msg.author_id), null); end if;
end $$;

create or replace function public.toggle_reaction(p_message uuid, p_emoji text) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_player_id();
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if exists (select 1 from public.reactions where message_id = p_message and player_id = me and emoji = p_emoji) then
    delete from public.reactions where message_id = p_message and player_id = me and emoji = p_emoji; return false;
  else
    insert into public.reactions (message_id, player_id, emoji) values (p_message, me, p_emoji); return true;
  end if;
end $$;

create or replace function public.mark_channel_read(p_channel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_player_id();
begin
  if me is null then return; end if;
  insert into public.channel_reads (channel_id, player_id, last_read_at) values (p_channel, me, now())
  on conflict (channel_id, player_id) do update set last_read_at = now();
end $$;

-- Unread counts for the current player, per channel
create or replace function public.unread_counts() returns table (channel_id uuid, unread bigint)
language sql stable security definer set search_path = public as $$
  select c.id, count(m.id)
  from public.channels c
  left join public.channel_reads r on r.channel_id = c.id and r.player_id = public.current_player_id()
  left join public.messages m on m.channel_id = c.id and m.deleted_at is null and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz) and (m.author_id is distinct from public.current_player_id())
  group by c.id
$$;

-- ---------------------------------------------------------------------------
-- Subs
-- ---------------------------------------------------------------------------
create or replace function public.claim_sub_request(p_request uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.sub_requests; me uuid := public.current_player_id();
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into r from public.sub_requests where id = p_request for update;
  if r.status <> 'open' then raise exception 'Someone already claimed this spot' using errcode = '22023'; end if;
  if public.is_member_of(r.team_id) then raise exception 'You are already on this team' using errcode = '22023'; end if;
  update public.sub_requests set status = 'claimed', claimed_by = me, claimed_at = now() where id = p_request returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.confirm_sub_claim(p_request uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.sub_requests;
begin
  select * into r from public.sub_requests where id = p_request for update;
  if not (public.is_admin() or public.is_captain_of(r.team_id)) then raise exception 'Only the captain can confirm' using errcode = '42501'; end if;
  if r.status <> 'claimed' then raise exception 'Nothing to confirm' using errcode = '22023'; end if;
  if p_accept then
    update public.sub_requests set status = 'confirmed', confirmed_at = now() where id = p_request returning * into r;
    insert into public.team_memberships (team_id, player_id, role) values (r.team_id, r.claimed_by, 'sub') on conflict (team_id, player_id) do nothing;
  else
    update public.sub_requests set status = 'open', claimed_by = null, claimed_at = null where id = p_request returning * into r;
  end if;
  return to_jsonb(r);
end $$;

-- ---------------------------------------------------------------------------
-- Account deletion (soft delete + auth user removal handled by the app with service role)
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_player_id();
begin
  if me is null then return; end if;
  delete from public.push_subscriptions where player_id = me;
  delete from public.team_memberships where player_id = me;
  update public.messages set body = '[deleted]', deleted_at = coalesce(deleted_at, now()) where author_id = me;
  update public.players set deleted_at = now(), display_name = 'Former player', nickname = null, avatar_url = null, email = null, phone = null, user_id = null where id = me;
end $$;

-- Scheduling helper used by the generator: does any team already play in that week?
create or replace function public.team_week_conflicts(p_week uuid, p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches where week_id = p_week and p_team in (home_team_id, away_team_id) and status <> 'void')
$$;
