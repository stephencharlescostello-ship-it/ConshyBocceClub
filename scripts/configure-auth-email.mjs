// Point Supabase Auth at a custom SMTP provider, apply the magic-link template (link + 6-digit code)
// and raise the auth email rate limit. Needed because the free tier refuses template edits while the
// built-in mailer is in use, and that mailer only sends ~2 emails/hour.
//
// Usage:
//   node scripts/configure-auth-email.mjs                 # apply SMTP + template + rate limit
//   node scripts/configure-auth-email.mjs --dry-run       # show what would be sent (password masked)
//   node scripts/configure-auth-email.mjs --show          # print the current auth email settings
//   node scripts/configure-auth-email.mjs --send-test you@example.com   # request a magic link for an address
//
// Reads SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER_EMAIL, SMTP_SENDER_NAME and
// AUTH_EMAIL_RATE_LIMIT (default 100/hour) from .env.production.local (or --env <file>) or the environment.
// Talks to the Supabase management API with SUPABASE_ACCESS_TOKEN, falling back to the token the
// Supabase CLI stored in the macOS keychain after `supabase login`. Project ref comes from
// SUPABASE_PROJECT_REF or supabase/.temp/project-ref (written by `supabase link`).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const envFile = path.resolve(root, opt("--env") ?? ".env.production.local");
const fileEnv = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) fileEnv[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
const env = (k, fallback) => process.env[k] ?? fileEnv[k] ?? fallback;

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  if (process.platform === "darwin") {
    try {
      return execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {}
  }
  throw new Error("No Supabase access token. Run `npx supabase login` or set SUPABASE_ACCESS_TOKEN.");
}
function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const f = path.join(root, "supabase/.temp/project-ref");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  throw new Error("No project ref. Run `npx supabase link --project-ref <ref>` or set SUPABASE_PROJECT_REF.");
}

const SUBJECT = "Sign in to CBC Shuffle";
const TEMPLATE = `<h2>Sign in to CBC Shuffle</h2>
<p><a href="{{ .ConfirmationURL }}">Tap here to sign in</a></p>
<p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
`;

const api = `https://api.supabase.com/v1/projects/${projectRef()}/config/auth`;
const headers = { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json" };
const WATCH = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_admin_email", "smtp_sender_name", "smtp_max_frequency", "mailer_subjects_magic_link", "mailer_templates_magic_link_content", "mailer_otp_length", "rate_limit_email_sent"];
const mask = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "smtp_pass" && v ? "<set>" : v]));

async function show() {
  const res = await fetch(api, { headers });
  if (!res.ok) throw new Error(`GET ${res.status}: ${await res.text()}`);
  const cfg = await res.json();
  console.log(JSON.stringify(mask(Object.fromEntries(WATCH.map((k) => [k, cfg[k]]))), null, 2));
  return cfg;
}

async function apply(dryRun) {
  const missing = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SENDER_EMAIL"].filter((k) => !env(k));
  if (missing.length) throw new Error(`Missing ${missing.join(", ")} in ${path.relative(root, envFile)} or the environment.`);
  const body = {
    smtp_host: env("SMTP_HOST"),
    smtp_port: String(env("SMTP_PORT")),
    smtp_user: env("SMTP_USER"),
    smtp_pass: env("SMTP_PASS"),
    smtp_admin_email: env("SMTP_SENDER_EMAIL"),
    smtp_sender_name: env("SMTP_SENDER_NAME", "CBC Shuffle"),
    smtp_max_frequency: Number(env("SMTP_MAX_FREQUENCY", 30)),
    mailer_subjects_magic_link: SUBJECT,
    mailer_templates_magic_link_content: TEMPLATE,
    mailer_otp_length: 6,
    rate_limit_email_sent: Number(env("AUTH_EMAIL_RATE_LIMIT", 100)),
  };
  console.log(`${dryRun ? "Would PATCH" : "PATCHing"} ${api}`);
  console.log(JSON.stringify(mask(body), null, 2));
  if (dryRun) return;
  const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PATCH ${res.status}: ${await res.text()}`);
  console.log("Applied. Current settings:");
  await show();
}

async function sendTest(email) {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const site = env("NEXT_PUBLIC_SITE_URL", "https://cbc-shuffle.vercel.app");
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not found.");
  const res = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: true, options: { email_redirect_to: `${site}/auth/callback?next=%2F` } }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`otp ${res.status}: ${text}`);
  console.log(`Magic link requested for ${email}. Check the inbox for "${SUBJECT}" with a link and a 6-digit code.`);
}

try {
  if (flag("--show")) await show();
  else if (opt("--send-test")) await sendTest(opt("--send-test"));
  else await apply(flag("--dry-run"));
} catch (err) {
  console.error(err.message ?? err);
  process.exit(1);
}
