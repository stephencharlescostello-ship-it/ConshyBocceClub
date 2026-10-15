import type { Metadata } from "next";
import Link from "next/link";
import { FileDown } from "lucide-react";

export const metadata: Metadata = { title: "Player quickstart" };

const STEPS = [
  { t: "Install the app", d: "Open the link or scan the table QR, then Add to Home Screen (iPhone: Share → Add to Home Screen; Android: Install)." },
  { t: "Sign in", d: "Enter your email. Tap the link we send or type the 6-digit code. You stay signed in all season." },
  { t: "Join your team", d: "Type the 6-letter join code from your captain, or claim your name from the roster." },
  { t: "Match night: scan the table", d: "The QR poster on your table opens tonight's match. Captains (or a designated scorekeeper) tap Keep Score." },
  { t: "Keep score", d: "Each frame, tap the points for the side that scored (+1, +2, +3, Hanger) then Next frame. Undo fixes mistakes. The app ends games and the match automatically and everyone watching sees it live." },
  { t: "Or use Quick Entry", d: "Kept score on the board? Enter the final score of each game instead." },
  { t: "Submit & confirm", d: "Submit when the match is over. The other captain gets a notification to confirm or dispute. Results auto-confirm after 12 hours and standings update instantly." },
  { t: "Talk trash", d: "Every match has a thread; every night has a room. @mention someone to get their attention. Keep it fun." },
];

export default function QuickstartPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Player quickstart</h1>
      <p className="mt-1 text-muted">Everything you need to know in under a minute.</p>
      <ol className="mt-4 flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={i} className="card flex gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-display font-extrabold text-accent-fg">{i + 1}</span>
            <span><span className="block font-semibold">{s.t}</span><span className="block text-sm text-muted">{s.d}</span></span>
          </li>
        ))}
      </ol>
      <a href="/docs/player-quickstart.pdf" className="btn btn-soft mt-4 w-full"><FileDown className="h-5 w-5" /> Printable PDF</a>
      <p className="mt-2 text-center text-sm"><Link href="/rules" className="text-accent underline">Full rules</Link> · <Link href="/install" className="text-accent underline">Install help</Link></p>
    </>
  );
}
