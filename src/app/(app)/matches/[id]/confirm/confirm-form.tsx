"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { confirmResult, disputeResult } from "@/lib/actions/scoring";
import { toast } from "@/components/ui/toast";

export function ConfirmForm({ matchId }: { matchId: string }) {
  const [note, setNote] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="text-sm font-semibold" htmlFor="note">Note (optional)</label>
      <textarea id="note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={disputing ? "What's wrong with the score?" : "Good game!"} />
      {!disputing ? (
        <>
          <button className="btn btn-primary btn-lg" disabled={pending} onClick={() => start(async () => { const r = await confirmResult(matchId, note || undefined); if (r.ok) { toast("Result confirmed", "success"); router.push(`/matches/${matchId}`); } else toast(r.message ?? "Failed", "error"); })}><CheckCircle2 className="h-6 w-6" /> {pending ? "Confirming…" : "Confirm result"}</button>
          <button className="btn btn-ghost text-danger" onClick={() => setDisputing(true)}><AlertTriangle className="h-5 w-5" /> Something&apos;s wrong — dispute</button>
        </>
      ) : (
        <>
          <button className="btn btn-danger btn-lg" disabled={pending || note.trim().length < 3} onClick={() => start(async () => { const r = await disputeResult(matchId, note); if (r.ok) { toast("Dispute sent to the commissioner", "success"); router.push(`/matches/${matchId}`); } else toast(r.message ?? "Failed", "error"); })}><AlertTriangle className="h-6 w-6" /> {pending ? "Sending…" : "File dispute"}</button>
          <button className="btn btn-ghost" onClick={() => setDisputing(false)}>Back</button>
        </>
      )}
    </div>
  );
}
