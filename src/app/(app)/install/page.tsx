import type { Metadata } from "next";
import { Share, PlusSquare, Smartphone } from "lucide-react";
import { InstallButton } from "@/components/shell/install-button";

export const metadata: Metadata = { title: "Install the app" };

export default function InstallPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Install CBC Shuffle</h1>
      <p className="mt-2 text-muted">Put it on your home screen: it opens full-screen, loads instantly, works offline at the table and can send notifications.</p>
      <section className="card mt-5 p-4" aria-labelledby="iphone">
        <h2 id="iphone" className="flex items-center gap-2 font-display text-lg font-bold"><Smartphone className="h-5 w-5 text-accent" /> iPhone (Safari)</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {[
            { icon: <Share className="h-7 w-7" />, title: "Tap Share", body: "The square with an arrow at the bottom of Safari." },
            { icon: <PlusSquare className="h-7 w-7" />, title: "Add to Home Screen", body: "Scroll the sheet a little if you don't see it." },
            { icon: <span className="font-display text-2xl font-extrabold">✓</span>, title: "Tap Add", body: "Open CBC Shuffle from your home screen from now on. Then turn on notifications in Settings." },
          ].map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">{s.icon}</span>
              <span><span className="block font-semibold">{i + 1}. {s.title}</span><span className="block text-sm text-muted">{s.body}</span></span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-subtle">Notifications on iPhone need iOS 16.4 or newer and only work for the installed app.</p>
      </section>
      <section className="card mt-4 p-4" aria-labelledby="android">
        <h2 id="android" className="flex items-center gap-2 font-display text-lg font-bold"><Smartphone className="h-5 w-5 text-accent" /> Android (Chrome)</h2>
        <p className="mt-2 text-sm text-muted">Tap the button below, or use Chrome&apos;s menu (⋮) → <span className="font-semibold text-fg">Add to Home screen</span>.</p>
        <InstallButton />
      </section>
    </>
  );
}
