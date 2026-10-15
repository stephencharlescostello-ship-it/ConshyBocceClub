import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditAdmin(props: PageProps<"/admin/audit">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const entity = typeof sp.entity === "string" ? sp.entity : "";
  const supabase = await createClient();
  let q = supabase.from("audit_log").select("*, actor:player_profiles!audit_log_actor_id_fkey(display_name)").order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  if (entity) q = q.eq("entity", entity);
  const { data } = await q;
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Audit log</h1>
      <div className="mt-2 flex gap-1">{["", "match", "season", "player", "message"].map((e) => <Link key={e} href={`/admin/audit?entity=${e}`} className={`chip ${entity === e ? "bg-accent text-accent-fg" : ""}`}>{e || "all"}</Link>)}</div>
      <ul className="mt-3 flex flex-col gap-1 text-xs">
        {(data ?? []).map((a) => (
          <li key={a.id} className="card p-2">
            <span className="font-semibold">{fmtDateTime(a.created_at)}</span> · {(a.actor as unknown as { display_name: string } | null)?.display_name ?? "system"} · <span className="font-mono">{a.action}</span> · {a.entity} {a.entity_id ? <Link href={a.entity === "match" ? `/admin/results/${a.entity_id}` : "#"} className="text-accent underline">{a.entity_id.slice(0, 8)}</Link> : null}
            {a.before ? <details className="mt-1"><summary className="cursor-pointer text-subtle">before / after</summary><pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(a.before)}
→ {JSON.stringify(a.after)}</pre></details> : a.after ? <span className="text-muted"> · {JSON.stringify(a.after)}</span> : null}
            {a.note && <span className="text-muted"> · {a.note}</span>}
          </li>
        ))}
        {!data?.length && <li className="text-muted">No entries.</li>}
      </ul>
      <div className="mt-3 flex gap-2">{page > 1 && <Link href={`/admin/audit?entity=${entity}&page=${page - 1}`} className="btn btn-soft !min-h-[36px] px-3 text-xs">Newer</Link>}{(data?.length ?? 0) === 50 && <Link href={`/admin/audit?entity=${entity}&page=${page + 1}`} className="btn btn-soft !min-h-[36px] px-3 text-xs">Older</Link>}</div>
    </>
  );
}
