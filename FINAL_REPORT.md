# FINAL_REPORT.md — CBC Shuffle

Built 2026-10-15. Everything below was run on a local Supabase stack (`supabase start`) and a production `next build`. Nothing is deployed yet because no Supabase/Vercel credentials were available; [SETUP.md](SETUP.md) is the 15-minute checklist.

## What was built

| Area | Delivered |
| --- | --- |
| Platform | Next.js 16.4 (App Router, TypeScript strict, Tailwind v4), Supabase (Postgres 17, Auth, Realtime, Storage), Web Push (VAPID), installable PWA with app-shell service worker and offline page, Capacitor config |
| Database | 44 tables/views, RLS on every table, 30+ SECURITY DEFINER RPCs that validate every write (frames, submissions, confirmations, disputes, chat rate limits and word filter), audit trigger on matches, realtime publication, storage policies |
| Accounts | Email magic link **and** 6-digit code, SMS behind a flag, join by 6-char code or roster claim, player/captain/admin roles, admin bootstrap by email, private email/phone (public `player_profiles` view) |
| Tonight | My match with countdown + giant Keep Score, tonight's matches live, pinned announcement, next event, latest trash talk, my record/rank, off-night view |
| Scoring | Live scorekeeper (+1/+2/+3/Hanger per side, frame history, undo, auto game/match end, haptics, lineups, realtime to every viewer, **offline queue in IndexedDB with idempotent frame ids**), Quick Entry, submit → opposing captain confirm/dispute with push, 12 h auto-confirm (cron + lazy), forfeits/postpone/make-ups, table QR deep links, admin overrides, audit log |
| Standings | Per-night tabs, W–L, games, +/−, streak, last 5, tap-to-explain tiebreakers, playoff line, clinched/eliminated, league Power Rankings with documented formula and commissioner blurbs |
| Schedule | By night/week/my team/results, bye/postponed/make-up badges, inline results, ICS feeds per team and night, add-to-calendar, circle-method generator (single/double, byes, balanced tables and slots), full admin editor with captain notifications |
| Teams & players | Team page (roster, captain tools, join code, head-to-head, results, chat link, calendar feed), player profile (photo upload, nickname, teams, stats, badges) |
| Stats | Hangers, points/frame, frame win %, game wins, streaks, comebacks; per night and league-wide; Hanger of the Week; 10 auto-awarded badges with graceful fallback for Quick Entry matches |
| Trash Talk | #league, one room per night, auto thread per match; realtime messages, replies, reactions, @mentions with push, device-compressed photos, GIFs when `GIPHY_API_KEY` is set, League Bot (template-based, no AI), blocked-word filter with leetspeak normalisation, reports, timed mutes, bans, rate limits, pinned rules, 5-min edit window, unread badges, per-channel notification mode |
| Events & comms | Events with RSVP/who's going/add-to-calendar/day-of reminder, announcements (targeted, push, pinned), notification inbox, per-type notification prefs |
| Subs, playoffs, history | Sub availability + board (claim → captain confirms → marked as sub), auto-seeded 1v4/2v3 brackets that advance live, Champion of Champions, Hall of Fame with final standings and season records, archived seasons |
| Admin console | Seasons (create/clone/archive, per-season format & tiebreakers & auto-confirm & playoff config, commissioner tiebreak decisions), nights/teams/rosters/tables, schedule generator/editor, results & dispute queue & overrides, events, announcements, rules/FAQ editor, moderation, users, dues tracker, CSV import (teams/players/schedule/results with column mapping, preview, per-row errors, dry run), CSV export of everything, QR poster PDF, audit log viewer, league settings |
| Share cards | Server-rendered 1080×1920 PNG cards for match results, standings and playoff wins |
| Seed data | 5 nights × 6 teams (real Monday/Wednesday names + original others), 152 players, half-played Fall 2026 season relative to today with 700+ frames, chat with bot posts, events, one open dispute, one pending confirmation, one open sub request — **plus the real Spring 2026 spreadsheet imported as an archived season** |

## Test results

| Suite | Result |
| --- | --- |
| Vitest unit (`npm test`) — scoring engine incl. hangers/game end/win-by-two, standings & every tiebreaker, schedule generator (meetings per pair, no double booking, balanced tables, byes), playoff seeding, offline queue sync, bot templates, CSV import against the real spreadsheet | **44 / 44 passed** |
| RLS & RPC integration (`npm run test:rls`) — anon vs player vs captain vs admin access, no email leakage, can't self-promote, can't score another team's match, impossible scores rejected in the DB, idempotent submissions, confirm/dispute permissions, blocked words, rate limits, private notifications | **13 / 13 passed** |
| Playwright end-to-end (`npm run test:e2e`, iPhone 15 + Pixel 7 viewports) — public browsing, sign in & join, live-score on one device while another watches then confirm → standings, dispute → admin resolves, realtime chat + @mention notification, RSVP, sub claim/confirm, admin schedule generation | **22 / 22 passed** (11 flows × 2 devices) |
| TypeScript strict / ESLint | 0 errors |
| Production build | clean |

## Lighthouse (mobile, production build)

| Page | Performance | Accessibility | Best Practices | SEO | LCP |
| --- | --- | --- | --- | --- | --- |
| / (Tonight) | 94 | 100 | 100 | 90 | 3.1 s |
| /standings | 98 | 100 | 100 | 90 | 2.5 s |
| /schedule | 97 | 100 | 100 | 90 | 2.6 s |
| /rules | 98 | 100 | 100 | 90 | 2.5 s |
| /events | 98 | 100 | 100 | 90 | 2.5 s |

Run with `npm run lighthouse` against `next build` + `next start` (mobile emulation, simulated 4G). Reports are in `lighthouse/*.report.html`. SEO sits at 90 only because the bottom tab labelled "More" counts as generic link text.

Lighthouse 12+ no longer has a PWA category; installability was verified directly: `manifest.webmanifest` (name, icons 192/512 + maskable, `display: standalone`, `start_url`), a service worker with a fetch handler and offline fallback, and HTTPS on Vercel.

## Screenshots

`npm run screenshots` captured every screen in dark and light at both device sizes into `screenshots/<project>/`. Key screens (dark, iPhone 15):

| Screen | File |
| --- | --- |
| Tonight (signed in, match tonight) | `screenshots/iphone-dark/player_.png` |
| Live scorekeeper | `screenshots/iphone-dark/player_scorekeeper.png` |
| Standings with playoff line | `screenshots/iphone-dark/public_standings.png` |
| Schedule | `screenshots/iphone-dark/public_schedule.png` |
| Match page (live view) | `screenshots/iphone-dark/public_match.png` |
| Trash Talk room | `screenshots/iphone-dark/player_chat_league.png` |
| Admin dashboard | `screenshots/iphone-dark/admin_admin.png` |
| Light theme | `screenshots/iphone-light/*.png` |

## Known limitations

- **Not deployed.** Supabase, Vercel, a domain and the GIF API key need your accounts (SETUP.md). The QR posters in `docs/` embed the placeholder `cbc-shuffle.vercel.app`; regenerate from Admin → QR posters after deploying.
- **Push on iPhone** needs the installed app (iOS 16.4+); the inbox always works. Push was exercised end-to-end locally only to the point of a saved subscription and a sent payload — real device delivery needs HTTPS.
- **Playoff scheduling** creates matches on the playoff week's night at the configured slot times; move them in Schedule → Edit if a night needs a different time.
- **Clinched/eliminated** uses a win-count approximation (ignores tiebreakers), as noted in-app.
- **Spring 2026 import** has no rosters (the sheet had none) and no playoff results, so the Hall of Fame lists regular-season champions for it.
- Playwright uses Chromium for both device profiles (no WebKit on this build machine).

## Remaining human steps (≈15 minutes)

1. Create the Supabase project, copy the three keys, set the magic-link email template (SETUP.md §1).
2. `npx supabase link` + `npm run db:migrate` (SETUP.md §2).
3. Import the repo in Vercel and paste the env vars; deploy (SETUP.md §3). Set the Supabase Site URL to the Vercel URL.
4. Sign in with the email you put in `ADMIN_BOOTSTRAP_EMAILS` → you're admin. Visit `/health`.
5. Create the real season, import teams (CSV templates in `docs/templates`), generate the schedule, print posters.
6. Optional: add `GIPHY_API_KEY`, a custom domain, Twilio for SMS sign-in, and drop the club logo at `public/branding/logo.png`.
