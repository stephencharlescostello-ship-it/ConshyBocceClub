"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Mail, Smartphone, KeyRound } from "lucide-react";
import { quickSignIn, sendMagicLink, sendSmsCode, verifyEmailCode, verifySmsCode, type AuthState } from "@/lib/actions/auth";

const init: AuthState = { ok: false };

export function SignInForm({ next, smsEnabled, devLogin }: { next: string; smsEnabled: boolean; devLogin: boolean }) {
  const [mode, setMode] = useState<"email" | "link" | "phone">("email");
  const [quick, quickAction, quickPending] = useActionState(quickSignIn, init);
  const [linkSent, sendAction, sending] = useActionState(sendMagicLink, init);
  // Admin accounts are asked for the emailed code even on the quick form.
  const sent: AuthState = quick.requireCode ? quick : linkSent;
  const [verified, verifyAction, verifying] = useActionState(verifyEmailCode, init);
  const [smsSent, smsAction, smsSending] = useActionState(sendSmsCode, init);
  const [smsVerified, smsVerifyAction, smsVerifying] = useActionState(verifySmsCode, init);

  if (mode === "phone") {
    return (
      <div className="mt-6 flex flex-col gap-4">
        {!smsSent.ok ? (
          <form action={smsAction} className="flex flex-col gap-3">
            <label className="text-sm font-semibold" htmlFor="phone">Mobile number</label>
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="input" placeholder="(610) 555-0123" required />
            {smsSent.message && <p role="alert" className="text-sm font-semibold text-danger">{smsSent.message}</p>}
            <button className="btn btn-primary btn-lg" disabled={smsSending}><Smartphone className="h-5 w-5" /> {smsSending ? "Sending…" : "Text me a code"}</button>
          </form>
        ) : (
          <form action={smsVerifyAction} className="flex flex-col gap-3">
            <input type="hidden" name="phone" value={smsSent.phone} />
            <label className="text-sm font-semibold" htmlFor="smscode">Enter the code we texted to {smsSent.phone}</label>
            <input id="smscode" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} className="input text-center text-2xl tracking-[0.5em]" required />
            {smsVerified.message && <p role="alert" className="text-sm font-semibold text-danger">{smsVerified.message}</p>}
            <button className="btn btn-primary btn-lg" disabled={smsVerifying}>{smsVerifying ? "Checking…" : "Continue"}</button>
          </form>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => setMode("email")}><Mail className="h-5 w-5" /> Use email instead</button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {!sent.ok && mode === "email" ? (
        <form action={quickAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label className="text-sm font-semibold" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" className="input" placeholder="you@example.com" defaultValue={quick.email} required />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold" htmlFor="first_name">First name</label>
              <input id="first_name" name="first_name" autoComplete="given-name" className="input" placeholder="Pat" maxLength={40} required />
            </div>
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold" htmlFor="last_name">Last name</label>
              <input id="last_name" name="last_name" autoComplete="family-name" className="input" placeholder="Rizzo" maxLength={40} required />
            </div>
          </div>
          {quick.message && !quick.requireCode && <p role="alert" className="text-sm font-semibold text-danger">{quick.message}</p>}
          <button className="btn btn-primary btn-lg" disabled={quickPending}><Mail className="h-5 w-5" /> {quickPending ? "Signing in…" : "Sign in"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setMode("link")}><KeyRound className="h-5 w-5" /> Email me a link or code instead</button>
        </form>
      ) : !sent.ok ? (
        <form action={sendAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label className="text-sm font-semibold" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" className="input" placeholder="you@example.com" required />
          {sent.message && <p role="alert" className="text-sm font-semibold text-danger">{sent.message}</p>}
          <button className="btn btn-primary btn-lg" disabled={sending}><Mail className="h-5 w-5" /> {sending ? "Sending…" : "Email me a sign-in link"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setMode("email")}>Back to quick sign-in</button>
        </form>
      ) : (
        <div className="card flex flex-col gap-4 p-4">
          <div>
            <p className="font-semibold">Check your email</p>
            <p className="mt-1 text-sm text-muted">{quick.requireCode ? "Admin accounts sign in with a code. " : ""}We sent a link and a code to <span className="font-semibold text-fg">{sent.email}</span>. Tap the link, or type the code here.</p>
          </div>
          <form action={verifyAction} className="flex flex-col gap-3">
            <input type="hidden" name="email" value={sent.email} />
            <input type="hidden" name="next" value={next} />
            <label className="sr-only" htmlFor="code">6-digit code</label>
            <input id="code" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} className="input text-center text-2xl tracking-[0.5em]" placeholder="••••••" required />
            {verified.message && <p role="alert" className="text-sm font-semibold text-danger">{verified.message}</p>}
            <button className="btn btn-primary btn-lg" disabled={verifying}><KeyRound className="h-5 w-5" /> {verifying ? "Checking…" : "Continue with code"}</button>
          </form>
          <form action={sendAction}>
            <input type="hidden" name="email" value={sent.email} />
            <input type="hidden" name="next" value={next} />
            <button className="btn btn-ghost w-full" disabled={sending}>Resend</button>
          </form>
        </div>
      )}
      {smsEnabled && (
        <button type="button" className="btn btn-ghost" onClick={() => setMode("phone")}><Smartphone className="h-5 w-5" /> Use my phone number instead</button>
      )}
      <p className="text-center text-sm text-subtle">
        Just browsing? <Link href="/" className="font-semibold text-accent underline">Standings and schedule are public.</Link>
      </p>
      {devLogin && (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-subtle">
          Local dev: <a className="font-semibold text-accent underline" href={`/dev/login?next=${encodeURIComponent(next)}`}>pick a seeded account</a> or read the link in <a className="underline" href="http://localhost:54324" target="_blank" rel="noreferrer">Mailpit</a>.
        </p>
      )}
    </div>
  );
}
