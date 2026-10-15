# SETUP.md — go live in about 15 minutes

You need accounts at **Supabase** (free tier is fine) and **Vercel** (free tier is fine), and the repo pushed to GitHub. Everything else is below. Do the steps in order.

## 1. Supabase project (4 min)

1. Go to https://supabase.com/dashboard → **New project**. Name: `cbc-shuffle`. Region: **East US (North Virginia)**. Save the database password somewhere.
2. When it finishes provisioning, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only, never commit it)
3. **Project Settings → Database → Connection string → URI** → `DATABASE_URL` (replace `[YOUR-PASSWORD]`).
4. **Authentication → Providers → Email**: leave *Enable Email provider* on, turn **Confirm email** off (magic links already prove ownership).
5. **Custom SMTP, then the Magic Link template.** Supabase's built-in mailer sends only ~2 emails an hour and, on the free tier, the dashboard and API refuse to change email templates while it is in use. So first point Auth at your own SMTP provider:
   - Create a free account at https://resend.com (3,000 emails/month). Under **Domains** add and verify the domain you will send from (`onboarding@resend.dev` works without a domain but only delivers to your own Resend account email). Under **API Keys** create a key with *Sending access*. No domain? Brevo's free plan (300 emails/day) verifies a plain email address as the sender instead; the same `SMTP_*` lines work with host `smtp-relay.brevo.com`, port `587`, the **Login** shown on Brevo's SMTP & API → SMTP tab (a generated `…@smtp-brevo.com` address, not your email) as the user, and an SMTP key (starts `xsmtpsib-`; API keys starting `xkeysib-` do not work) as the password. Turn off Brevo's authorized-IP restriction (Settings → Security), since Supabase sends from changing IPs. After `npm run auth:email`, give Supabase a minute to reload before testing.
   - Either fill it in at **Project Settings → Auth → SMTP Settings** (host `smtp.resend.com`, port `465`, username `resend`, password = the API key, sender email/name) and raise **Authentication → Rate Limits → Emails sent** to 100/hour, or put the key in `.env.production.local` as `SMTP_PASS` (with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_SENDER_EMAIL`, `SMTP_SENDER_NAME`) and run `npm run auth:email`, which sets SMTP, the template below and the 100/hour limit in one go. Never commit the key.
   - **Authentication → Email Templates → Magic Link**: subject `Sign in to CBC Shuffle`, body as below so the email carries both a link and a 6-digit code (iPhone users who open the link outside the installed app can type the code instead):
   ```html
   <h2>Sign in to CBC Shuffle</h2>
   <p><a href="{{ .ConfirmationURL }}">Tap here to sign in</a></p>
   <p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
   Test with `npm run auth:email -- --send-test you@example.com`: the email should come from your sender and typing the code on `/sign-in` must sign you in.
6. **Authentication → URL Configuration**: Site URL = your Vercel URL (you'll get it in step 3; come back and set it), Redirect URLs: add `https://<your-domain>/**`.

## 2. Push the database (2 min)

On your computer, inside the repo:

```bash
npm install
npx supabase login                 # opens the browser once
npx supabase link --project-ref <ref>   # <ref> is the part of the Project URL before .supabase.co
npm run db:migrate                 # applies every migration in supabase/migrations
```

Seed data is optional in production. To load the demo season (teams, players, results, chat) run `npx supabase db reset --linked` **before** any real data exists; otherwise start clean and import your teams from CSV in the admin console.

## 3. Vercel (4 min)

1. https://vercel.com/new → import the GitHub repo. Framework preset: **Next.js**. Keep the defaults.
2. **Environment Variables** — add every line of `.env.example`:

   | Variable | Where it comes from |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://<project>.vercel.app` (or your domain), no trailing slash |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, *anon public* |
   | `SUPABASE_SERVICE_ROLE_KEY` | same page, *service_role* |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | run `npx web-push generate-vapid-keys` once |
   | `VAPID_SUBJECT` | `mailto:you@example.com` |
   | `CRON_SECRET` | any long random string (`openssl rand -hex 24`) |
   | `ADMIN_BOOTSTRAP_EMAILS` | your email — makes you admin on first sign-in |
   | `ALLOW_DEV_LOGIN` | `false` |
   | `GIPHY_API_KEY` | optional, from developers.giphy.com — enables the GIF button |
   | `NEXT_PUBLIC_ENABLE_SMS_SIGNIN` | `false` (set `true` only after configuring Twilio in Supabase Auth) |
   | `DATABASE_URL` | not needed on Vercel |

3. **Deploy**. Copy the URL, then go back to Supabase → Authentication → URL Configuration and set Site URL + Redirect URL to it.
4. Vercel → Project → **Settings → Cron Jobs** should show the two jobs from `vercel.json` (`/api/cron/auto-confirm` daily at 14:00 UTC, `/api/cron/reminders` daily at 13:00 UTC; Vercel Hobby allows only daily crons, so results past their 12 h window are confirmed on the next run rather than within the hour). They authenticate with `CRON_SECRET` automatically.

## 4. Make yourself the first admin (1 min)

Open the deployed site → **Sign in** with the email you put in `ADMIN_BOOTSTRAP_EMAILS`. You are an admin the moment you land. Later admins are promoted in **Admin → Users**.

Alternative (SQL, Supabase → SQL Editor):
```sql
update public.players set is_admin = true where email = 'you@example.com';
```

## 5. Check everything (1 min)

Visit **`/health`**. Every row should be green: database (RLS on), auth, realtime, push (VAPID), service role, cron secret, site URL. `/api/health` returns the same as JSON for uptime monitors.

## 6. First season (3 min)

Admin → **Seasons & format** → *Create season* (format defaults: to 15, best of 3, hanger 4). Then **Nights, teams & rosters** (or **Import CSV** with `docs/templates/*.csv` — dry run first), then **Schedule → Generate**. Print **QR posters** and tape them to the tables. Pin a welcome announcement. Done.

## Local development

`supabase start` + `npm run db:reset` + `npm run dev` brings up the whole app with seed data; see README.md. Magic-link emails land in Mailpit at http://localhost:54324, or use http://localhost:3000/dev/login.
