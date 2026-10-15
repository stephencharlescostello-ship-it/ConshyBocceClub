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

## Build-time decisions (added while implementing)
- **Scorekeeper UX**: taps add weights to the *current frame* for one side (+1/+2/+3/Hanger); tapping the other side restarts the frame for that side because only one side scores per frame. "Next frame" commits; "Wash" records a 0–0 frame; "Undo" removes the last weight, or the last committed frame when the frame is empty. Every committed frame carries a device-generated UUID so a retry or an offline replay can never double-count.
- **Who may run the scorekeeper**: captains of either team, a scorekeeper the captain designates on the match page, and admins. Other players get the live view. Enforced in the database (`can_score_match`), not just the UI.
- **Server-side validation lives in Postgres RPCs** (`record_frame`, `submit_match_result`, `confirm_match`, `dispute_match`, `resolve_dispute`, `post_message`, …) so a crafted request from any client is rejected the same way as a UI mistake. Server actions only add zod parsing, notifications and cache revalidation.
- **Standings tiebreak explanation**: each row stores the tiebreaker that separated it from the row below ("Ahead on head-to-head"); unresolved ties say "commissioner decision" and the admin sets the order on the season page.
- **Clinched/eliminated markers** appear once 60% of the regular season is played and use a win-count approximation (ignoring tiebreakers), documented in-app.
- **Power rankings formula**: 50 × match win % + 30 × game win % + 2 × point differential per match + 3 × wins in the last five, shown on the page.
- **Share cards** are 1080×1920 PNGs rendered with `next/og` (Satori) from live data; no image assets to maintain.
- **Table QR deep link** (`/t/<token>`) picks the live match on that table, else the match starting within 20 minutes, else the next one today; captains land on the scorekeeper, everyone else on the live view, and unknown tokens go to the schedule.
- **Playwright runs both device profiles in Chromium** (iPhone 15 and Pixel 7 viewports/user agents). WebKit was skipped because this macOS build has no WebKit Playwright support; the PWA itself targets Safari 16.4+.
- **Local dev server port**: the Mac used for building had port 3000 reserved at the time, so `.claude/launch.json`, `.env.local` and the Supabase redirect list also allow 3001. Nothing else depends on the port.
- **Hanger of the Week** is recomputed for a match's week every time a result confirms, from live-scored frames and the recorded lineups.
- **Audit log** is written by a trigger on every material change to a match (status, scores, winner, time, table, forfeit) and explicitly by admin actions (season edits, dispute resolutions, schedule generation, moderation).
- **Seed accounts** are created directly in `auth.users` (Supabase local only) so Playwright and the dev login can sign in without email. Production never uses the seed.
- **Club address** is seeded as a town-level placeholder ("Conshohocken Bocce Club, Conshohocken, PA 19428") because the exact street address was not provided; set it in Admin → League settings.
