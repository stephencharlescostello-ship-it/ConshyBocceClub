"use client";
import { useActionState, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveFaq, saveRules } from "@/lib/actions/admin-content";
import type { ActionState } from "@/lib/actions/team";

export function RulesEditor({ rules, faq }: { rules: { title: string; body: string }; faq: { id: string; q: string; a: string }[] }) {
  const [rs, raction, rpending] = useActionState(saveRules, { ok: false } as ActionState);
  const [fs, faction, fpending] = useActionState(saveFaq, { ok: false } as ActionState);
  const [body, setBody] = useState(rules.body);
  const [items, setItems] = useState(faq.length ? faq : [{ id: "", q: "", a: "" }]);
  const [preview, setPreview] = useState(false);
  return (
    <div className="mt-3 flex flex-col gap-6">
      <form action={raction} className="card flex flex-col gap-3 p-4">
        <input type="hidden" name="slug" value="rules" />
        <label className="flex flex-col gap-1 text-sm font-semibold">Page title<input name="title" defaultValue={rules.title} className="input" /></label>
        <div className="flex items-center justify-between"><span className="text-sm font-semibold">Rules (Markdown)</span><button type="button" className="text-sm text-accent underline" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</button></div>
        {preview ? <div className="prose-md rounded-xl border border-border p-4"><ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown></div> : <textarea name="body_md" rows={24} className="input font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} />}
        {preview && <input type="hidden" name="body_md" value={body} />}
        {rs.message && <p className={`text-sm font-semibold ${rs.ok ? "text-success" : "text-danger"}`}>{rs.message}</p>}
        <button className="btn btn-primary self-start" disabled={rpending}>Save rules</button>
      </form>
      <form action={faction} className="card flex flex-col gap-3 p-4">
        <p className="font-display font-bold">FAQ</p>
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <input type="hidden" name="id" value={it.id} />
            <input name="question" defaultValue={it.q} placeholder="Question" className="input" />
            <textarea name="answer_md" defaultValue={it.a} placeholder="Answer (Markdown)" rows={2} className="input mt-2" />
            <button type="button" className="mt-1 text-xs text-danger" onClick={() => setItems((x) => x.filter((_, k) => k !== i))}>remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-soft self-start" onClick={() => setItems((x) => [...x, { id: "", q: "", a: "" }])}>+ Question</button>
        {fs.message && <p className={`text-sm font-semibold ${fs.ok ? "text-success" : "text-danger"}`}>{fs.message}</p>}
        <button className="btn btn-primary self-start" disabled={fpending}>Save FAQ</button>
      </form>
    </div>
  );
}
