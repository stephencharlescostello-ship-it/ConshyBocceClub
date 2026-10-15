export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "Scheduled", cls: "bg-elev-2 text-muted" },
    live: { label: "LIVE", cls: "bg-danger-soft text-danger" },
    submitted: { label: "Pending", cls: "bg-accent-soft text-accent" },
    confirmed: { label: "Final", cls: "bg-primary-soft text-success" },
    disputed: { label: "Disputed", cls: "bg-danger-soft text-danger" },
    postponed: { label: "Postponed", cls: "bg-elev-2 text-warning" },
    forfeit: { label: "Forfeit", cls: "bg-elev-2 text-muted" },
    bye: { label: "Bye", cls: "bg-elev-2 text-subtle" },
    void: { label: "Void", cls: "bg-elev-2 text-subtle" },
  };
  const m = map[status] ?? { label: status, cls: "bg-elev-2 text-muted" };
  return (
    <span className={`chip ${m.cls}`}>
      {status === "live" && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-danger" />}
      {m.label}
    </span>
  );
}
