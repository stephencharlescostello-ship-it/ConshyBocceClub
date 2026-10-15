import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { RulesEditor } from "@/components/admin/rules-editor";

export const metadata: Metadata = { title: "Rules admin" };
export const dynamic = "force-dynamic";

export default async function RulesAdmin() {
  const supabase = await createClient();
  const [{ data: rules }, { data: faq }] = await Promise.all([supabase.from("rules_pages").select("*").eq("slug", "rules").maybeSingle(), supabase.from("faq_items").select("*").order("sort_order")]);
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Rules &amp; FAQ</h1>
      <RulesEditor rules={{ title: rules?.title ?? "Rules & Policies", body: rules?.body_md ?? "" }} faq={(faq ?? []).map((f) => ({ id: f.id, q: f.question, a: f.answer_md }))} />
    </>
  );
}
