-- CBC Shuffle — Row Level Security on every table.
-- Public (anon) can read schedule/standings/results/events/rules. Writes go through RPCs or narrow policies.

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Revoke direct access to private columns' tables where a view exists
revoke all on public.players from anon;
grant select on public.player_profiles to anon, authenticated;
grant select on public.team_records to anon, authenticated;

-- Helper macro-ish policies -------------------------------------------------
-- settings
create policy settings_read on public.settings for select using (is_public or public.is_admin());
create policy settings_admin on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- league structure: public read, admin write
create policy seasons_read on public.seasons for select using (true);
create policy seasons_admin on public.seasons for all using (public.is_admin()) with check (public.is_admin());
create policy nights_read on public.league_nights for select using (true);
create policy nights_admin on public.league_nights for all using (public.is_admin()) with check (public.is_admin());
create policy tables_read on public.tables for select using (true);
create policy tables_admin on public.tables for all using (public.is_admin()) with check (public.is_admin());
create policy teams_read on public.teams for select using (true);
create policy teams_admin on public.teams for all using (public.is_admin()) with check (public.is_admin());
create policy weeks_read on public.weeks for select using (true);
create policy weeks_admin on public.weeks for all using (public.is_admin()) with check (public.is_admin());

-- join codes: members of the team + admins
create policy team_secrets_read on public.team_secrets for select using (public.is_admin() or public.is_member_of(team_id));
create policy team_secrets_admin on public.team_secrets for all using (public.is_admin()) with check (public.is_admin());

-- players: self + admin only (everyone else uses player_profiles)
create policy players_self_read on public.players for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy players_self_update on public.players for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and is_admin = (select p.is_admin from public.players p where p.id = players.id));
create policy players_admin on public.players for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- memberships: public read (rosters are public), captains manage their team, admins all
create policy memberships_read on public.team_memberships for select using (true);
create policy memberships_captain_insert on public.team_memberships for insert to authenticated with check (public.is_admin() or public.is_captain_of(team_id));
create policy memberships_captain_update on public.team_memberships for update to authenticated using (public.is_admin() or public.is_captain_of(team_id)) with check (public.is_admin() or public.is_captain_of(team_id));
create policy memberships_delete on public.team_memberships for delete to authenticated using (public.is_admin() or public.is_captain_of(team_id) or player_id = public.current_player_id());

create policy sub_availability_read on public.sub_availability for select to authenticated using (true);
create policy sub_availability_self on public.sub_availability for all to authenticated using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());

-- matches / games / frames: public read; writes via RPC; admins may edit rows directly (schedule editing)
create policy matches_read on public.matches for select using (true);
create policy matches_admin on public.matches for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy games_read on public.games for select using (true);
create policy games_admin on public.games for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy frames_read on public.frames for select using (true);
create policy frames_admin on public.frames for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy submissions_read on public.score_submissions for select to authenticated using (public.is_admin() or submitted_by = public.current_player_id() or exists (select 1 from public.matches m where m.id = match_id and (public.is_member_of(m.home_team_id) or public.is_member_of(m.away_team_id))));
create policy confirmations_read on public.confirmations for select using (true);
create policy disputes_read on public.disputes for select to authenticated using (public.is_admin() or exists (select 1 from public.matches m where m.id = match_id and (public.is_member_of(m.home_team_id) or public.is_member_of(m.away_team_id))));
create policy disputes_admin on public.disputes for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- playoffs, badges, awards, power rankings: public read, admin write
create policy brackets_read on public.playoff_brackets for select using (true);
create policy brackets_admin on public.playoff_brackets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy slots_read on public.playoff_slots for select using (true);
create policy slots_admin on public.playoff_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy badges_read on public.badges for select using (true);
create policy badges_admin on public.badges for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy player_badges_read on public.player_badges for select using (true);
create policy player_badges_admin on public.player_badges for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy awards_read on public.awards for select using (true);
create policy awards_admin on public.awards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy power_read on public.power_rankings for select using (true);
create policy power_admin on public.power_rankings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- chat: signed-in only
create policy channels_read on public.channels for select to authenticated using (true);
create policy channels_admin on public.channels for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy messages_read on public.messages for select to authenticated using (true);
create policy messages_admin_update on public.messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reactions_read on public.reactions for select to authenticated using (true);
create policy reactions_self on public.reactions for all to authenticated using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());
create policy reports_insert on public.message_reports for insert to authenticated with check (reporter_id = public.current_player_id());
create policy reports_read on public.message_reports for select to authenticated using (public.is_admin() or reporter_id = public.current_player_id());
create policy reports_admin on public.message_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mutes_read on public.mutes for select to authenticated using (public.is_admin() or player_id = public.current_player_id());
create policy mutes_admin on public.mutes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy bans_read on public.bans for select to authenticated using (public.is_admin() or player_id = public.current_player_id());
create policy bans_admin on public.bans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy channel_reads_self on public.channel_reads for all to authenticated using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());
create policy channel_settings_self on public.channel_settings for all to authenticated using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());
create policy blocked_words_admin on public.blocked_words for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- events & comms
create policy events_read on public.events for select using (true);
create policy events_admin on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy rsvps_read on public.rsvps for select using (true);
create policy rsvps_self on public.rsvps for all to authenticated using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());
create policy announcements_read on public.announcements for select using (true);
create policy announcements_admin on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notifications_self on public.notifications for select to authenticated using (player_id = public.current_player_id());
create policy notifications_self_update on public.notifications for update to authenticated using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());
create policy notifications_self_delete on public.notifications for delete to authenticated using (player_id = public.current_player_id());
create policy push_self on public.push_subscriptions for all to authenticated using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());
create policy prefs_self on public.notification_prefs for all to authenticated using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());

-- subs
create policy sub_requests_read on public.sub_requests for select to authenticated using (true);
create policy sub_requests_captain on public.sub_requests for insert to authenticated with check (public.is_admin() or public.is_captain_of(team_id));
create policy sub_requests_captain_update on public.sub_requests for update to authenticated using (public.is_admin() or public.is_captain_of(team_id)) with check (public.is_admin() or public.is_captain_of(team_id));

-- admin tables
create policy dues_read on public.dues for select to authenticated using (public.is_admin() or player_id = public.current_player_id());
create policy dues_admin on public.dues for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());
create policy rules_read on public.rules_pages for select using (true);
create policy rules_admin on public.rules_pages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy faq_read on public.faq_items for select using (true);
create policy faq_admin on public.faq_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy import_jobs_admin on public.import_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- RPC execution rights: anon may only call read-only helpers
revoke execute on all functions in schema public from public, anon;
grant execute on function public.match_state(uuid), public.auto_confirm_due(), public.is_admin(), public.current_player_id() to anon, authenticated;
grant execute on function
  public.start_match(uuid), public.record_frame(uuid,int,uuid,uuid,int,int,jsonb), public.undo_frame(uuid), public.set_game_lineup(uuid,int,jsonb,jsonb), public.set_scorekeeper(uuid,uuid),
  public.submit_match_result(uuid,jsonb,text,text,text), public.confirm_match(uuid,text), public.dispute_match(uuid,text), public.resolve_dispute(uuid,text,jsonb,text),
  public.set_forfeit(uuid,uuid,text), public.postpone_match(uuid,timestamptz,text), public.admin_reset_match(uuid,text),
  public.join_team_with_code(text), public.claim_roster_player(uuid), public.rotate_join_code(uuid),
  public.post_message(uuid,text,uuid,text,text,text), public.edit_message(uuid,text), public.delete_message(uuid), public.toggle_reaction(uuid,text), public.mark_channel_read(uuid), public.unread_counts(),
  public.claim_sub_request(uuid), public.confirm_sub_claim(uuid,boolean), public.delete_my_account(),
  public.is_member_of(uuid), public.is_captain_of(uuid), public.can_score_match(uuid), public.contains_blocked_word(text), public.team_week_conflicts(uuid,uuid)
to authenticated;
