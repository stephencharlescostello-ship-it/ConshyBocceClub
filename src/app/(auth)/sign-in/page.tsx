import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "./sign-in-form";
import { getViewer } from "@/lib/data/session";
import { devLoginEnabled, publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/onboarding";
  const viewer = await getViewer();
  if (viewer) redirect(next === "/onboarding" ? "/" : next);
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Sign in</h1>
      <p className="mt-2 text-muted">We&apos;ll email you a link and a 6-digit code. No password to remember.</p>
      {typeof sp.error === "string" && <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{sp.error}</p>}
      <SignInForm next={next} smsEnabled={publicEnv.smsSignIn} devLogin={devLoginEnabled} />
    </>
  );
}
