/** Server-side environment access with clear errors. Never import from client components. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See SETUP.md.`);
  return v;
}

export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  smsSignIn: process.env.NEXT_PUBLIC_ENABLE_SMS_SIGNIN === "true",
};

export const isDev = process.env.NODE_ENV === "development";
export const devLoginEnabled = isDev && process.env.ALLOW_DEV_LOGIN === "true";
