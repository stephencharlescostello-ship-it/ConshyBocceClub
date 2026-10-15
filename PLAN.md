# CBC Shuffle — Build Plan

Conshohocken Bocce Club shuffleboard league app. Installable PWA (Next.js 16 App Router, TypeScript strict, Tailwind v4) on Supabase (Postgres, Auth, Realtime, Storage), Web Push (VAPID), deployed to Vercel.

## 1. Architecture

```
 phone (PWA, service worker, IndexedDB queue)
   │  HTTPS
   ▼
 Next.js 16 (Vercel)
   ├─ Server Components  → Supabase (user JWT, RLS)        read paths
   ├─ Server Actions      → zod validate → RPC / RLS write  mutation paths
   ├─ Route handlers      → ICS feeds, share cards (ImageResponse), posters PDF, CSV export,
   │                        push subscribe, cron (auto-confirm, reminders), /api/health
   └─ proxy.ts            → refreshes the Supabase session cookie on every request
 Supabase
   ├─ Postgres: ~45 tables, RLS on every one, SECURITY DEFINER RPCs for multi-row writes
   ├─ Auth: magic link (email); SMS OTP behind a flag; sessions last the season
   ├─ Realtime: postgres_changes on frames/games/matches/messages/reactions/sub_requests
   └─ Storage: avatars, chat-photos, event-covers (public read, owner write)
```

Rendering model: Cache Components is **off** (`cacheComponents: false`). Nearly every screen is per-user or live, so pages render dynamically on the server, stream with Suspense where helpful, and the service worker caches the app shell for instant loads and offline.

Scoring engine, standings/tiebreakers, schedule generator, playoff seeding and the offline queue are **pure TypeScript modules** in `src/lib/engine/*` with Vitest coverage. The database enforces the same rules in RPCs (`record_frame`, `submit_match_result`, `confirm_match`, `dispute_match`) so no client can write an impossible score.

## 2. Schema (Postgres, schema `public`)

League structure
- `seasons` (status draft|active|archived, format jsonb, tiebreakers text[], auto_confirm_hours, playoff config)
- `league_nights` (season, weekday 1–5, name, start_time, slot_times time[])
- `tables` (club level: name, qr_token, active)
- `teams` (season, night, name, slug, join_code, color)
- `weeks` (season, number, starts_on, kind regular|playoff|champions)

People
- `players` (id = auth user id when claimed; display_name, nickname, avatar_url, email PRIVATE, phone PRIVATE, is_admin)
- `team_memberships` (team, player, role captain|player|sub)
- `sub_availability` (player, weekday)

Matches & scoring
- `matches` (season, night, week, home/away team, table, slot, scheduled_at, status scheduled|live|submitted|confirmed|disputed|postponed|forfeit|bye, winner, game/point totals, entry_mode live|quick|import, playoff fields, version)
- `games` (match, number, scores, winner, status, lineup jsonb)
- `frames` (game, number, scoring_team, points, is_hanger, client_id unique for idempotency)
- `score_submissions` (match, submitted_by, payload, idempotency_key unique)
- `confirmations` (match, team, decision confirm|dispute, note)
- `disputes` (match, opened_by, note, status open|resolved, resolution)

Standings & playoffs
- `team_records` view (confirmed results only); ranking + tiebreakers computed in TS
- `playoff_brackets`, `playoff_slots`
- `badges`, `player_badges`, `awards`, `power_rankings` (blurbs)

Chat
- `channels` (kind league|night|match|dm), `messages` (reply_to, deleted_at, edited_at), `reactions`, `message_reports`, `mutes`, `bans`, `channel_reads`, `channel_settings`, `blocked_words`

Events & comms
- `events`, `rsvps`, `announcements`, `notifications` (inbox), `push_subscriptions`, `notification_prefs`

Subs
- `sub_requests`, `sub_claims`

Admin
- `dues`, `audit_log`, `settings` (key/value), `rules_pages`, `faq_items`, `import_jobs`

Every table: RLS enabled; helper functions `is_admin()`, `is_captain_of(team)`, `is_member_of(team)`; emails/phones never selectable by other players (public view `player_profiles`).

## 3. Screen map

Public (no login): `/` Tonight · `/standings` (Mon–Fri tabs, power rankings) · `/schedule` · `/matches/[id]` live view · `/teams/[id]` · `/players/[id]` · `/events`, `/events/[id]` · `/rules` · `/history`, `/history/[season]` · `/playoffs` · `/stats` · `/install` · `/quickstart` · `/t/[token]` (table QR deep link) · `/health`

Signed in: `/matches/[id]/score` live scorekeeper · `/matches/[id]/quick` · `/matches/[id]/confirm` · `/chat`, `/chat/[channel]` · `/subs` · `/announcements` · `/notifications` · `/profile`, `/settings` · `/join` · `/onboarding`

Admin: `/admin` · seasons · nights/teams/rosters · format · schedule (generate/edit) · results & disputes · events · announcements · rules · moderation · users · dues · import (CSV, mapping, dry run) · export · posters · audit log

API: `/api/ics/team/[id]`, `/api/ics/night/[id]` · `/api/cards/match/[id]`, `/api/cards/standings/[night]`, `/api/cards/playoff/[id]` · `/api/push/subscribe` · `/api/cron/auto-confirm`, `/api/cron/reminders` · `/api/admin/posters.pdf`, `/api/admin/export/[table]` · `/api/health` · `/auth/callback`

## 4. Build order (one commit per slice)

1. Foundation: config, theme tokens, shell, Supabase clients, migrations, seed generator, types
2. Auth & roles: magic link, callback, join code / claim roster, admin bootstrap, RLS tests
3. Teams & schedule: team/player pages, schedule views, generator, ICS, admin editing
4. Scoring & standings: engine, live scorekeeper (realtime, offline queue), quick entry, submit/confirm/dispute, audit, standings + tiebreak explain, table QR deep links
5. Chat: channels, realtime messages, replies, reactions, mentions, photos, bot, moderation
6. Events, announcements, push: inbox, VAPID push, RSVP, reminders, pinned announcement
7. Subs, playoffs, stats, history: sub board, brackets + seeding, leaderboards/badges, hall of fame, share cards
8. Admin & import: console, CSV import (mapping, dry run), export, posters PDF, dues, audit viewer
9. Polish: screenshots at iPhone/Pixel sizes both themes, Lighthouse, a11y, docs, PDFs, zip

## 5. Testing

- Vitest: scoring engine, standings & tiebreakers, schedule generator, playoff seeding, offline queue, bot templates, CSV mapper
- Vitest (integration, needs `supabase start`): RLS policies via `pg` as anon/authenticated users
- Playwright (iPhone 15 + Pixel 7 projects): the nine required flows; a separate config shoots every screen in both themes
