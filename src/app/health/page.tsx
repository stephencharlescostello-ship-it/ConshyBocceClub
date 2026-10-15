import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { GET as healthGet } from "@/app/api/health/route";

export const metadata: Metadata = { title: "Health" };
export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const res = await healthGet();
  const data = (await res.json()) as { ok: boolean; checks: Record<string, { ok: boolean; detail: string }>; time: string };
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold">System health</h1>
      <p className="mt-1 text-muted">{data.ok ? "Everything is wired up." : "Something needs attention."} Checked {new Date(data.time).toLocaleString()}.</p>
      <ul className="mt-6 flex flex-col gap-3">
        {Object.entries(data.checks).map(([k, c]) => (
          <li key={k} className="card flex items-start gap-3 p-4">
            {c.ok ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-danger" />}
            <div>
              <p className="font-semibold capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
              <p className="text-sm text-muted">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <Link href="/" className="btn btn-ghost mt-6">Back to the app</Link>
    </main>
  );
}
