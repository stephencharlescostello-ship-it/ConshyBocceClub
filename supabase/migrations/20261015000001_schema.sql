-- CBC Shuffle — core schema
-- Every table gets RLS in 20261015000003_rls.sql. Multi-row writes go through RPCs in 20261015000002_functions.sql.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Settings (key/value, admin editable)
-- ---------------------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ---------------------------------------------------------------------------
-- League structure
-- ---------------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  starts_on date not null,
  regular_weeks int not null default 10 check (regular_weeks between 1 and 52),
  playoff_weeks int not null default 2 check (playoff_weeks between 0 and 8),
  -- Scoring format. Changing it only affects this season.
  format jsonb not null default '{"zones":[1,2,3],"hanger_points":4,"weights_per_side":4,"target_score":15,"win_by_two":false,"games_per_match":3}'::jsonb,
  tiebreakers text[] not null default array['win_pct','head_to_head','game_diff','point_diff','admin'],
  auto_confirm_hours int not null default 12 check (auto_confirm_hours between 0 and 168),
  playoff_config jsonb not null default '{"teams_per_night":4,"champion_of_champions":true}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index seasons_one_active on public.seasons ((status)) where status = 'active';

create table public.league_nights (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  weekday int not null check (weekday between 1 and 7), -- 1 = Monday … 7 = Sunday (ISO)
  name text not null,
  slug text not null,
  start_time time not null default '18:00',
  slot_times time[] not null default array['18:00'::time,'19:00'::time,'20:00'::time],
  sort_order int not null default 0,
  unique (season_id, weekday),
  unique (season_id, slug)
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  qr_token text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  night_id uuid not null references public.league_nights(id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default '#1f6f4a',
  created_at timestamptz not null default now(),
  unique (night_id, name),
  unique (season_id, slug)
);

-- Join codes are kept out of the public teams table so RLS can restrict them.
create table public.team_secrets (
  team_id uuid primary key references public.teams(id) on delete cascade,
  join_code text not null unique,
  rotated_at timestamptz not null default now()
);

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  number int not null,
  starts_on date not null, -- the Monday
  kind text not null default 'regular' check (kind in ('regular','playoff','champions','bye')),
  label text,
  unique (season_id, number)
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  nickname text,
  avatar_url text,
  email extensions.citext,          -- PRIVATE: only the player and admins can read
  phone text,                        -- PRIVATE
  is_admin boolean not null default false,
  bio text,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index players_email_idx on public.players (email);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null default 'player' check (role in ('captain','player','sub')),
  joined_at timestamptz not null default now(),
  unique (team_id, player_id)
);
create index team_memberships_player_idx on public.team_memberships (player_id);

create table public.sub_availability (
  player_id uuid not null references public.players(id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),
  primary key (player_id, weekday)
);

-- ---------------------------------------------------------------------------
-- Matches & scoring
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  night_id uuid not null references public.league_nights(id) on delete cascade,
  week_id uuid not null references public.weeks(id) on delete cascade,
  home_team_id uuid references public.teams(id) on delete cascade,
  away_team_id uuid references public.teams(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  slot_index int not null default 0,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','submitted','confirmed','disputed','postponed','forfeit','bye','void')),
  entry_mode text check (entry_mode in ('live','quick','import','admin')),
  winner_team_id uuid references public.teams(id),
  forfeit_team_id uuid references public.teams(id),
  home_games int not null default 0,
  away_games int not null default 0,
  home_points int not null default 0,
  away_points int not null default 0,
  current_game int not null default 1,
  scorekeeper_player_id uuid references public.players(id),
  submitted_by uuid references public.players(id),
  submitted_at timestamptz,
  submitting_team_id uuid references public.teams(id),
  confirmed_by uuid references public.players(id),
  confirmed_at timestamptz,
  auto_confirm_at timestamptz,
  bracket_id uuid,
  playoff_round int,
  is_makeup boolean not null default false,
  postponed_from timestamptz,
  notes text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id is distinct from away_team_id)
);
create index matches_night_week_idx on public.matches (night_id, week_id);
create index matches_season_status_idx on public.matches (season_id, status);
create index matches_teams_idx on public.matches (home_team_id, away_team_id);
create index matches_sched_idx on public.matches (scheduled_at);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  number int not null check (number between 1 and 9),
  home_score int not null default 0 check (home_score >= 0),
  away_score int not null default 0 check (away_score >= 0),
  status text not null default 'pending' check (status in ('pending','live','final')),
  winner_team_id uuid references public.teams(id),
  home_lineup jsonb not null default '[]'::jsonb,
  away_lineup jsonb not null default '[]'::jsonb,
  frame_count int not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  unique (match_id, number)
);

create table public.frames (
  id uuid primary key, -- generated on the device so a retry can never duplicate a frame
  game_id uuid not null references public.games(id) on delete cascade,
  number int not null,
  scoring_team_id uuid references public.teams(id),
  points int not null default 0 check (points >= 0),
  hangers int not null default 0 check (hangers >= 0),
  weights jsonb not null default '[]'::jsonb,
  recorded_by uuid references public.players(id),
  recorded_at timestamptz not null default now(),
  unique (game_id, number)
);

create table public.score_submissions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  submitted_by uuid references public.players(id),
  team_id uuid references public.teams(id),
  idempotency_key text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid references public.teams(id),
  player_id uuid references public.players(id),
  decision text not null check (decision in ('confirm','dispute','auto')),
  note text,
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  opened_by uuid references public.players(id),
  team_id uuid references public.teams(id),
  note text,
  status text not null default 'open' check (status in ('open','resolved','withdrawn')),
  resolution text,
  resolved_by uuid references public.players(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Playoffs, badges, awards, power rankings
-- ---------------------------------------------------------------------------
create table public.playoff_brackets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  night_id uuid references public.league_nights(id) on delete cascade,
  kind text not null default 'night' check (kind in ('night','champions')),
  name text not null,
  status text not null default 'pending' check (status in ('pending','live','complete')),
  champion_team_id uuid references public.teams(id),
  created_at timestamptz not null default now()
);
alter table public.matches add constraint matches_bracket_fk foreign key (bracket_id) references public.playoff_brackets(id) on delete set null;

create table public.playoff_slots (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.playoff_brackets(id) on delete cascade,
  round int not null,
  position int not null,
  seed int,
  team_id uuid references public.teams(id),
  match_id uuid references public.matches(id) on delete set null,
  feeds_slot_id uuid references public.playoff_slots(id),
  unique (bracket_id, round, position)
);

create table public.badges (
  slug text primary key,
  name text not null,
  description text not null,
  icon text not null default 'award'
);

create table public.player_badges (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  badge_slug text not null references public.badges(slug) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique (player_id, badge_slug, season_id)
);

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  kind text not null, -- hanger_of_week, night_champion, season_record, ...
  week_number int,
  player_id uuid references public.players(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  value numeric,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (season_id, kind, week_number, player_id, team_id)
);

create table public.power_rankings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  week_number int not null,
  blurb text not null,
  created_by uuid references public.players(id),
  created_at timestamptz not null default now(),
  unique (season_id, team_id, week_number)
);

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete cascade,
  kind text not null check (kind in ('league','night','match')),
  slug text not null,
  name text not null,
  night_id uuid references public.league_nights(id) on delete cascade,
  match_id uuid unique references public.matches(id) on delete cascade,
  rules text,
  created_at timestamptz not null default now(),
  unique (season_id, slug)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid references public.players(id) on delete set null,
  is_bot boolean not null default false,
  body text not null default '',
  photo_url text,
  gif_url text,
  reply_to uuid references public.messages(id) on delete set null,
  mentions uuid[] not null default '{}',
  client_id text unique,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.players(id)
);
create index messages_channel_created_idx on public.messages (channel_id, created_at desc);

create table public.reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, player_id, emoji)
);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.players(id) on delete cascade,
  reason text,
  status text not null default 'open' check (status in ('open','dismissed','actioned')),
  resolved_by uuid references public.players(id),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table public.mutes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  until timestamptz not null,
  reason text,
  created_by uuid references public.players(id),
  created_at timestamptz not null default now()
);

create table public.bans (
  player_id uuid primary key references public.players(id) on delete cascade,
  reason text,
  created_by uuid references public.players(id),
  created_at timestamptz not null default now()
);

create table public.channel_reads (
  channel_id uuid not null references public.channels(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, player_id)
);

create table public.channel_settings (
  channel_id uuid not null references public.channels(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  mode text not null default 'mentions' check (mode in ('all','mentions','off')),
  primary key (channel_id, player_id)
);

create table public.blocked_words (
  word text primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Events & comms
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  title text not null,
  kind text not null default 'social' check (kind in ('tournament','social','playoffs','banquet','deadline','other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  description text,
  cover_url text,
  target_night_ids uuid[] not null default '{}', -- empty = whole league
  rsvp_enabled boolean not null default true,
  reminder_sent_at timestamptz,
  created_by uuid references public.players(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('going','maybe','no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  title text not null,
  body text not null,
  target_night_ids uuid[] not null default '{}',
  pinned boolean not null default false,
  push boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.players(id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  url text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_player_idx on public.notifications (player_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  failures int not null default 0
);

create table public.notification_prefs (
  player_id uuid primary key references public.players(id) on delete cascade,
  scores boolean not null default true,
  mentions boolean not null default true,
  announcements boolean not null default true,
  events boolean not null default true,
  subs boolean not null default true,
  schedule boolean not null default true,
  chat boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Subs
-- ---------------------------------------------------------------------------
create table public.sub_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  night_id uuid not null references public.league_nights(id) on delete cascade,
  needed_at timestamptz not null,
  note text,
  status text not null default 'open' check (status in ('open','claimed','confirmed','cancelled')),
  claimed_by uuid references public.players(id),
  claimed_at timestamptz,
  confirmed_at timestamptz,
  created_by uuid references public.players(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create table public.dues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  amount_cents int not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  note text,
  updated_at timestamptz not null default now(),
  unique (season_id, player_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_user_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  note text,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create table public.rules_pages (
  slug text primary key,
  title text not null,
  body_md text not null,
  sort_order int not null default 0,
  updated_by uuid references public.players(id),
  updated_at timestamptz not null default now()
);

create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer_md text not null,
  sort_order int not null default 0
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  file_name text,
  mapping jsonb not null default '{}'::jsonb,
  dry_run boolean not null default true,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.players(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Public, privacy-safe projection of players (no email / phone)
-- ---------------------------------------------------------------------------
create view public.player_profiles with (security_invoker = false) as
  select id, user_id is not null as has_account, display_name, nickname, avatar_url, is_admin, bio, created_at
  from public.players
  where deleted_at is null;

-- Base records from confirmed results only (ranking/tiebreaks happen in TypeScript).
create view public.team_records with (security_invoker = false) as
  with played as (
    select m.season_id, m.night_id, t.id as team_id,
      case when m.winner_team_id = t.id then 1 else 0 end as win,
      case when m.winner_team_id is not null and m.winner_team_id <> t.id then 1 else 0 end as loss,
      case when m.home_team_id = t.id then m.home_games else m.away_games end as games_won,
      case when m.home_team_id = t.id then m.away_games else m.home_games end as games_lost,
      case when m.home_team_id = t.id then m.home_points else m.away_points end as points_for,
      case when m.home_team_id = t.id then m.away_points else m.home_points end as points_against,
      case when m.forfeit_team_id = t.id then 1 else 0 end as forfeits
    from public.matches m
    join public.teams t on t.id in (m.home_team_id, m.away_team_id)
    where m.status in ('confirmed','forfeit') and m.playoff_round is null
  )
  select t.id as team_id, t.season_id, t.night_id, t.name,
    coalesce(sum(p.win),0)::int as wins, coalesce(sum(p.loss),0)::int as losses,
    coalesce(sum(p.games_won),0)::int as games_won, coalesce(sum(p.games_lost),0)::int as games_lost,
    coalesce(sum(p.points_for),0)::int as points_for, coalesce(sum(p.points_against),0)::int as points_against,
    coalesce(sum(p.forfeits),0)::int as forfeits
  from public.teams t
  left join played p on p.team_id = t.id
  group by t.id;

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger players_touch before update on public.players for each row execute function public.touch_updated_at();
create trigger matches_touch before update on public.matches for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
