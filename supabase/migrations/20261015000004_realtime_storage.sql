-- Realtime publication + storage policies

alter table public.matches replica identity full;
alter table public.games replica identity full;
alter table public.frames replica identity full;
alter table public.messages replica identity full;
alter table public.reactions replica identity full;
alter table public.sub_requests replica identity full;
alter table public.notifications replica identity full;
alter table public.playoff_slots replica identity full;

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.matches, public.games, public.frames, public.messages, public.reactions, public.sub_requests, public.notifications, public.playoff_slots;

-- Storage: public-read buckets, owners write into their own folder (<player_id>/...), admins anything.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars','avatars', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('chat-photos','chat-photos', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']),
  ('event-covers','event-covers', true, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "public read images" on storage.objects for select using (bucket_id in ('avatars','chat-photos','event-covers'));
create policy "players upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_player_id()::text);
create policy "players update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_player_id()::text);
create policy "players delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = public.current_player_id()::text or public.is_admin()));
create policy "players upload chat photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = public.current_player_id()::text and not public.is_banned());
create policy "delete chat photos" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-photos' and ((storage.foldername(name))[1] = public.current_player_id()::text or public.is_admin()));
create policy "admins manage event covers" on storage.objects for insert to authenticated with check (bucket_id = 'event-covers' and public.is_admin());
create policy "admins update event covers" on storage.objects for update to authenticated using (bucket_id = 'event-covers' and public.is_admin());
create policy "admins delete event covers" on storage.objects for delete to authenticated using (bucket_id = 'event-covers' and public.is_admin());
