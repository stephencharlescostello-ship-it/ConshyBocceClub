# DECISIONS.md — assumptions and choices

Each entry: what was ambiguous, what was chosen, and where it is configurable.

## Platform
- **Next.js 16.4 with Cache Components off.** The scaffold enables `cacheComponents`; the app is almost entirely per-user and live, so the classic dynamic rendering model is used and the service worker caches the app shell instead. (`next.config.ts`)
- **Tailwind v4** with every color defined as a CSS variable token in `src/app/globals.css` (`--color-*`). Dark is the default theme; light and system are selectable in Settings and stored in a cookie + `localStorage`.
- **No node version manager on the build Mac**, so Node 24 LTS was installed under `~/.local/node`, and Docker is provided by Lima + Colima (`~/.local/bin`). SETUP.md documents installing these normally.

## League data
- **The attached spreadsheet is the Spring 2026 season ("S26").** Its games went to **11**, not 15, so that season is imported with `target_score = 11`; the default format for new seasons stays at 15, no win-by-2, best of 3. Format lives on the season, so past results are never reinterpreted.
- S26 only had Monday and Wednesday nights (6 teams each). It is seeded as an **archived** season with all 60 real matches imported through the same CSV importer code path used by the admin console.
- The S26 Monday Week 10 match *Keep It On The Board 0–0 Anywhere But Home* (0–11, 0–11) is recorded as a **forfeit** by Keep It On The Board, matching the FF column on the Standings tab.
- The current season is seeded as **Fall 2026**, 5 nights × 6 teams. Monday and Wednesday carry the real S26 team names forward; Tuesday, Thursday and Friday get original team names. It is seeded half played (weeks 1–4 confirmed, week 5 in progress) relative to **today's date** so the Tonight screen is always alive on first run.
- When the spreadsheet had each match reported twice (once by each team), the importer pairs the two rows; a mismatch becomes a per-row validation error instead of a silent pick.

## Format & schedule
- Tables default to **two** physical tables ("Table 1", "Table 2"); matches run in three slots at 6:00, 7:00 and 8:00 PM, with the generator balancing tables. Both are editable per night/season in Admin → Format.
- Hanger = 4 points, zones 1/2/3, only the side with the farthest weight scores. Editable per season.
- Results auto-confirm after **12 hours** (season setting `auto_confirm_hours`). A Vercel cron calls `/api/cron/auto-confirm` hourly; the home page also triggers the same RPC lazily so local dev needs no cron.
- Standings tiebreakers default order: match win % → head-to-head → game differential → point differential → admin decision (`seasons.tiebreakers`).
- Playoffs: top 4 per night, 1v4 / 2v3 then a final; both rounds use the season format. Champion of Champions is an optional bracket of night winners.

## Accounts
- **Magic link + 6-digit code.** The email contains both a link and a code; the sign-in page accepts the code too, because an iOS user who opens the email link in Safari would otherwise land outside the installed PWA (PKCE verifier lives in the app's cookie jar).
- **First admin**: any email listed in `ADMIN_BOOTSTRAP_EMAILS` becomes admin on first sign-in. SETUP.md also gives the one-line SQL.
- **Local dev sign-in**: Mailpit (http://localhost:54324) receives magic links; additionally `/dev/login` (only when `NODE_ENV=development` and `ALLOW_DEV_LOGIN=true`) signs in as any seeded user to speed up testing. It is not compiled into production.
- Players stay signed in: JWT expiry 7 days with refresh token rotation (Supabase), sessions refreshed by `proxy.ts`.

## Chat
- Profanity allowed; slurs blocked by `blocked_words` (admin editable). Matches are checked with word boundaries and common leetspeak substitutions.
- Edit window 5 minutes; delete own messages anytime; rate limit 1 message / 2 s and 20 / minute per user (RPC `post_message`).
- GIF button shows only when `GIPHY_API_KEY` is set.

## Notifications
- Web Push via VAPID. iOS requires the app to be installed; the Install sheet explains this. The in-app inbox always receives every notification.
- A player's mention triggers a push regardless of channel setting unless the player muted mentions globally.

## Stats
- Hanger of the Week: most hangers Mon–Sun among live-scored games; ties broken by points per frame.
- Quick Entry matches contribute game wins, points for/against and streaks; frame stats are skipped for them.
