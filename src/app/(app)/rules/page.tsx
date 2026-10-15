import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mail, MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/league";

export const metadata: Metadata = { title: "Rules & info" };
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const supabase = await createClient();
  const [{ data: pages }, { data: faq }, settings] = await Promise.all([
    supabase.from("rules_pages").select("slug, title, body_md").order("sort_order"),
    supabase.from("faq_items").select("question, answer_md").order("sort_order"),
    getSettings(),
  ]);
  const club = settings.club ?? {};
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Rules &amp; info</h1>
      <nav className="mt-2 flex flex-wrap gap-2 text-sm" aria-label="Sections">
        <a href="#rules" className="chip">Rules</a><a href="#faq" className="chip">FAQ</a><a href="#contact" className="chip">Contact &amp; directions</a>
      </nav>
      <section id="rules" className="card mt-4 p-4">
        {(pages ?? []).map((p) => (
          <article key={p.slug} className="prose-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.body_md}</ReactMarkdown>
          </article>
        ))}
      </section>
      <section id="faq" className="mt-6" aria-labelledby="faq-h">
        <h2 id="faq-h" className="font-display text-xl font-bold">FAQ</h2>
        <div className="mt-2 flex flex-col gap-2">
          {(faq ?? []).map((f, i) => (
            <details key={i} className="card group p-4">
              <summary className="cursor-pointer list-none font-semibold">{f.question}</summary>
              <div className="prose-md mt-2 text-sm"><ReactMarkdown>{f.answer_md}</ReactMarkdown></div>
            </details>
          ))}
        </div>
      </section>
      <section id="contact" className="card mt-6 p-4" aria-labelledby="contact-h">
        <h2 id="contact-h" className="font-display text-xl font-bold">Contact &amp; directions</h2>
        <p className="mt-2 flex items-center gap-2"><Mail className="h-5 w-5 text-accent" /> <a className="underline" href={`mailto:${String(club.contact_email ?? "")}`}>{String(club.contact_name ?? "Commissioner")}</a></p>
        {club.contact_phone ? <p className="mt-1 flex items-center gap-2"><Phone className="h-5 w-5 text-accent" /> <a className="underline" href={`tel:${String(club.contact_phone)}`}>{String(club.contact_phone)}</a></p> : null}
        <p className="mt-1 flex items-start gap-2"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> <a className="underline" href={String(club.map_url ?? "#")} target="_blank" rel="noreferrer">{String(club.address ?? "Conshohocken Bocce Club")}</a></p>
      </section>
    </>
  );
}
