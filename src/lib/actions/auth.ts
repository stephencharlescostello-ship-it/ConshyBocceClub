"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/util/rate-limit";

export type AuthState = { ok: boolean; message?: string; email?: string; phone?: string; requireCode?: boolean };

const emailSchema = z.string().trim().toLowerCase().email();
const nameSchema = z.string().trim().min(1).max(40);

function adminEmails() {
  return (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Sign in with just an email address and a name: no password, no emailed code. The league chose
 * convenience over proof of ownership, so this is as trusted as a name on a paper scoresheet.
 * Admin accounts are the exception: they still get the emailed link and code.
 */
export async function quickSignIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const first = nameSchema.safeParse(formData.get("first_name"));
  const last = nameSchema.safeParse(formData.get("last_name"));
  if (!email.success) return { ok: false, message: "Enter a valid email address." };
  if (!first.success || !last.success) return { ok: false, message: "Enter your first and last name.", email: email.data };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`auth:${ip}`, 10, 60_000) || !rateLimit(`auth:${email.data}`, 5, 60_000)) return { ok: false, message: "Too many attempts. Try again in a minute.", email: email.data };
  const next = String(formData.get("next") ?? "/");
  const admin = createAdminClient();
  const { data: adminRow } = await admin.from("players").select("id").eq("email", email.data).eq("is_admin", true).is("deleted_at", null).maybeSingle();
  if (adminRow || adminEmails().includes(email.data)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ email: email.data, options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true } });
    if (error) return { ok: false, message: error.message, email: email.data };
    return { ok: true, email: email.data, requireCode: true };
  }
  const fullName = `${first.data} ${last.data}`.replace(/\s+/g, " ");
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: email.data, options: { data: { display_name: fullName }, redirectTo: publicEnv.siteUrl } });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return { ok: false, message: linkError?.message ?? "Could not sign you in. Try again.", email: email.data };
  const supabase = await createClient();
  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verifyError || !session.user) return { ok: false, message: "Could not sign you in. Try again.", email: email.data };
  // A roster name entered by the commissioner wins; only replace the placeholder made from the email.
  await admin.from("players").update({ display_name: fullName }).eq("user_id", session.user.id).eq("display_name", email.data.split("@")[0]);
  redirect(next.startsWith("/") ? next : "/onboarding");
}

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`auth:${ip}`, 10, 60_000) || !rateLimit(`auth:${parsed.data}`, 5, 60_000)) return { ok: false, message: "Too many attempts. Try again in a minute." };
  const next = String(formData.get("next") ?? "/");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, email: parsed.data };
}

export async function verifyEmailCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  if (!email.success || token.length < 6) return { ok: false, message: "Enter the 6-digit code from the email.", email: email.success ? email.data : undefined };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token, type: "email" });
  if (error) return { ok: false, message: "That code didn't work. Codes expire after an hour.", email: email.data };
  await bootstrapAdminIfListed();
  redirect(String(formData.get("next") || "/onboarding"));
}

export async function sendSmsCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!publicEnv.smsSignIn) return { ok: false, message: "Phone sign-in is not enabled." };
  const phone = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "");
  if (phone.length < 10) return { ok: false, message: "Enter a valid phone number." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: phone.startsWith("+") ? phone : `+1${phone}` });
  if (error) return { ok: false, message: error.message };
  return { ok: true, phone: phone.startsWith("+") ? phone : `+1${phone}` };
}

export async function verifySmsCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const phone = String(formData.get("phone") ?? "");
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { ok: false, message: "That code didn't work.", phone };
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Grants admin to emails in ADMIN_BOOTSTRAP_EMAILS on sign-in (how the commissioner becomes the first admin). */
export async function bootstrapAdminIfListed() {
  const list = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email || !list.includes(email) || !data.user) return;
  const admin = createAdminClient();
  await admin.from("players").update({ is_admin: true }).eq("user_id", data.user.id);
}
