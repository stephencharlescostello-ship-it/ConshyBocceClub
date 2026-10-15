# ADMIN_GUIDE.md — the commissioner's one page

Open the app → **More → Admin console** (phone-friendly; nicer on a laptop).

## Start a season and import teams
1. **Seasons & format → Create season.** Name, start date (the Monday of week 1), 10 regular weeks + 2 playoff weeks. The scoring format (game to 15, best of 3, hanger = 4, win-by-two off) and tiebreaker order are per season — changing them never rewrites past seasons. *Clone last season* copies nights, teams and rosters.
2. **Make active.** Only one season is active; the previous one is archived automatically (never deleted — see History).
3. **Nights, teams & rosters.** Each night has start time and slots (6:00, 7:00, 8:00). Add teams with a captain name/email, or **Import CSV → Teams / Players** using the templates in `docs/templates/`. Always click **Dry run** first: every row is validated and you see exactly what will be created.
4. Captains share the 6-letter **join code** (shown on the team page); players can also claim their imported name from the roster when they sign in.
5. Tables: add/rename under the same page, then **QR posters → Generate PDF** (one per table + a general "get the app" poster).

## Generate the schedule
**Schedule → Generate round robin.** Pick nights, single or double round robin, Preview, then **Apply**. The preview shows meetings per pair, byes, double-bookings (always 0) and table balance. Edit any match below it (time, table, teams, swap, postpone, delete) — captains are notified. Add make-up matches at the bottom. Public **Schedule** tab, team calendar feeds and the Tonight screen update instantly.

## Handle disputes and fix results
- **Results & disputes → Pending** lists submitted scores waiting on the opposing captain (they auto-confirm after 12 h, configurable per season).
- **Disputes** shows each open dispute with the captain's note. Open the match: **Uphold** (keep as submitted), **Correct to scores below** (edit the games, then confirm), **Order replay**, or **Void**. Both captains are notified and the change is in the audit trail.
- Any played match can be edited, forfeited (either team), reset to scheduled, or voided from the same screen. Standings recalculate immediately.
- Standings ties that survive every tiebreaker show "commissioner decision": set the order in **Seasons → Commissioner tiebreak decisions**.

## Playoffs
After week 10, **Playoffs → Seed playoff brackets** creates 1v4 / 2v3 per night from the final standings. Later rounds are created automatically as results confirm. When all night champions are decided, create the **Champion of Champions** bracket.

## Post announcements, run events, moderate chat
- **Announcements**: title + message, target everyone or specific nights, optional push, optional pin to Home (one pinned at a time). Use for weather closures, schedule changes, dues reminders.
- **Events**: tournaments, socials, playoffs, banquet, deadlines. RSVP counts and the list of who's going are on the event page; a day-of reminder goes to everyone who said Going/Maybe.
- **Moderation**: reported messages appear here with Dismiss / Delete / Mute author / Ban author. Profanity is allowed; the **blocked words** list rejects slurs (edit it anytime). Mute and ban any player from **Users**.
- **Users**: search, see contact details (admins only), promote admins, remove players. **Dues**: paid/unpaid per player with amount and notes — tracking only.
- **Export** gives CSVs of everything; **Audit log** shows who changed what and when, with before/after values.

## If something looks wrong
`/health` checks the database, auth, realtime and push wiring. Scores entered offline sit on the player's phone as "pending sync" and send when they regain signal; nothing is lost.
