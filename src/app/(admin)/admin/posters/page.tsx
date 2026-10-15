import type { Metadata } from "next";
import { FileDown, QrCode } from "lucide-react";
import { getTables } from "@/lib/data/league";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "QR posters" };
export const dynamic = "force-dynamic";

export default async function PostersAdmin() {
  const tables = await getTables();
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">QR posters</h1>
      <p className="text-sm text-muted">One US-Letter poster per active table (deep-links to the match on that table) plus a general “Get the app” poster. Print on cardstock, tape to the table ends.</p>
      <a href="/api/admin/posters" target="_blank" rel="noreferrer" className="btn btn-primary mt-3"><FileDown className="h-5 w-5" /> Generate PDF ({tables.length + 1} pages)</a>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {tables.map((t) => <li key={t.id} className="card flex items-center justify-between p-3"><span className="flex items-center gap-2 font-semibold"><QrCode className="h-4 w-4 text-accent" /> {t.name}</span><a className="font-mono text-xs text-accent underline" href={`/t/${t.qr_token}`} target="_blank" rel="noreferrer">{publicEnv.siteUrl}/t/{t.qr_token}</a></li>)}
        <li className="card flex items-center justify-between p-3"><span className="flex items-center gap-2 font-semibold"><QrCode className="h-4 w-4 text-accent" /> Get the app</span><span className="font-mono text-xs text-muted">{publicEnv.siteUrl}</span></li>
      </ul>
      <p className="mt-3 text-xs text-subtle">Posters embed the site URL from NEXT_PUBLIC_SITE_URL. Regenerate after deploying to your real domain. Manage tables under Nights, teams &amp; rosters.</p>
    </>
  );
}
