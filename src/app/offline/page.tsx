import Link from "next/link";
import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="h-12 w-12 text-subtle" />
      <h1 className="font-display text-2xl font-extrabold">You&apos;re offline</h1>
      <p className="text-muted">Scores you enter while offline are saved on this phone and sync when the signal comes back.</p>
      <Link href="/" className="btn btn-primary">Try again</Link>
    </main>
  );
}
