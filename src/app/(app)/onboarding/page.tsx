import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { getViewer } from "@/lib/data/session";
import { NotificationsStep } from "./notifications-step";
import { completeOnboarding } from "@/lib/actions/team";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=/onboarding");
  const sp = await props.searchParams;
  const hasTeam = viewer.memberships.length > 0;
  const step = typeof sp.step === "string" ? sp.step : hasTeam ? "notifications" : "team";
  const steps = [
    { key: "signin", label: "Sign in", done: true },
    { key: "team", label: "Join your team", done: hasTeam },
    { key: "notifications", label: "Turn on notifications", done: step === "done" },
  ];
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Welcome, {viewer.player.display_name.split(" ")[0]} 👋</h1>
      <ol className="mt-5 flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-sm font-semibold">
            {s.done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-subtle" />}
            <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        {step === "team" && (
          <div className="card flex flex-col gap-3 p-4">
            <p className="font-semibold">Which team are you on?</p>
            <p className="text-sm text-muted">Enter the join code your captain shared, or find your name on the roster.</p>
            <Link href="/join" className="btn btn-primary btn-lg">Join my team</Link>
            <Link href="/onboarding?step=notifications" className="btn btn-ghost">I&apos;m just here to watch</Link>
          </div>
        )}
        {step === "notifications" && <NotificationsStep />}
        {step === "done" && (
          <form action={completeOnboarding} className="card flex flex-col gap-3 p-4">
            <p className="font-semibold">You&apos;re all set.</p>
            <p className="text-sm text-muted">Tonight&apos;s match, standings and the trash talk room are one tap away.</p>
            <button className="btn btn-accent btn-lg">Take me to Tonight</button>
          </form>
        )}
      </div>
    </>
  );
}
