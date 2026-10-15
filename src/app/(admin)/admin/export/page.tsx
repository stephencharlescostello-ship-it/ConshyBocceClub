import type { Metadata } from "next";
import { Download } from "lucide-react";

export const metadata: Metadata = { title: "Export" };

const TABLES = ["teams", "players", "matches", "games", "frames", "standings", "events", "rsvps", "announcements", "dues", "sub_requests", "messages", "badges", "awards", "audit_log"];

export default function ExportAdmin() {
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Export</h1>
      <p className="text-sm text-muted">CSV of every table, flattened with related names. Player emails and phones are included only here, for admins.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
        {TABLES.map((t) => <li key={t}><a href={`/api/admin/export/${t}`} className="btn btn-soft w-full justify-start"><Download className="h-4 w-4" /> {t.replace("_", " ")}.csv</a></li>)}
      </ul>
    </>
  );
}
