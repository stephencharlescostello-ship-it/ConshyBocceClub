"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Send, Image as ImageIcon, Smile, Reply, Trash2, Pencil, Flag, X, Bell, BellOff, AtSign, Film } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { postMessage, editMessage, deleteMessage, toggleReaction, reportMessage, setChannelMode, markRead } from "@/lib/actions/chat";
import { compressImage } from "@/lib/util/image";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { fmtTime, fmtDate, isToday } from "@/lib/util/time";

export type ChatMessage = { id: string; authorId: string | null; isBot: boolean; body: string; photoUrl: string | null; gifUrl: string | null; replyTo: string | null; createdAt: string; editedAt: string | null; deletedAt: string | null; authorName: string; authorAvatar: string | null; reactions: { emoji: string; player_id: string }[]; pending?: boolean };

const EMOJIS = ["🔥", "😂", "👀", "💀", "🏆", "🪝", "👏", "😤"];

export function ChatRoom({ channelId, channelSlug, rules, initial, me, mode, mentionables, gifsEnabled, mutedUntil }: { channelId: string; channelSlug: string; rules: string | null; initial: ChatMessage[]; me: { id: string; name: string; isAdmin: boolean }; mode: "all" | "mentions" | "off"; mentionables: { id: string; name: string; nick: string | null }[]; gifsEnabled: boolean; mutedUntil: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [notif, setNotif] = useState(mode);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifs, setGifs] = useState<{ id: string; preview: string; url: string; title: string }[]>([]);
  const [gifQuery, setGifQuery] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  void channelSlug;

  const profiles = useMemo(() => new Map(mentionables.map((p) => [p.id, p])), [mentionables]);
  const scrollDown = useCallback(() => bottomRef.current?.scrollIntoView({ block: "end" }), []);
  useEffect(() => { scrollDown(); }, [scrollDown]);

  // Realtime: new/edited/deleted messages and reactions
  useEffect(() => {
    const supabase = getBrowserClient();
    const load = async (id: string) => {
      const { data } = await supabase.from("messages").select("id, author_id, is_bot, body, photo_url, gif_url, reply_to, created_at, edited_at, deleted_at, client_id, author:player_profiles!messages_author_id_fkey(display_name, avatar_url), reactions(emoji, player_id)").eq("id", id).maybeSingle();
      if (!data) return;
      const msg: ChatMessage = { id: data.id, authorId: data.author_id, isBot: data.is_bot, body: data.body, photoUrl: data.photo_url, gifUrl: data.gif_url, replyTo: data.reply_to, createdAt: data.created_at, editedAt: data.edited_at, deletedAt: data.deleted_at, authorName: data.is_bot ? "League Bot" : (data.author as unknown as { display_name: string } | null)?.display_name ?? "Former player", authorAvatar: (data.author as unknown as { avatar_url: string | null } | null)?.avatar_url ?? null, reactions: (data.reactions as { emoji: string; player_id: string }[]) ?? [] };
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id || (data.client_id && m.id === data.client_id));
        if (idx >= 0) return prev.map((m, i) => (i === idx ? msg : m));
        return [...prev, msg].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
      setTimeout(scrollDown, 50);
      markRead(channelId);
    };
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, (p) => { const id = (p.new as { id?: string })?.id; if (id) load(id); })
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, (p) => { const id = ((p.new as { message_id?: string })?.message_id ?? (p.old as { message_id?: string })?.message_id); if (id && messages.some((m) => m.id === id)) load(id); else if (id) load(id); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const send = () => {
    const body = text.trim();
    if (!body && !editing) return;
    if (editing) {
      const target = editing;
      setEditing(null);
      setText("");
      start(async () => { const r = await editMessage(target.id, body); if (!r.ok) toast(r.message ?? "Could not edit", "error"); });
      return;
    }
    const clientId = crypto.randomUUID();
    const optimistic: ChatMessage = { id: clientId, authorId: me.id, isBot: false, body, photoUrl: null, gifUrl: null, replyTo: replyTo?.id ?? null, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null, authorName: me.name, authorAvatar: null, reactions: [], pending: true };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    const reply = replyTo?.id ?? null;
    setReplyTo(null);
    setTimeout(scrollDown, 30);
    start(async () => {
      const r = await postMessage({ channelId, body, replyTo: reply, clientId });
      if (!r.ok) { setMessages((prev) => prev.filter((m) => m.id !== clientId)); toast(r.message ?? "Could not send", "error"); setText(body); }
    });
  };

  const sendMedia = async (kind: "photo" | "gif", url: string) => {
    const clientId = crypto.randomUUID();
    start(async () => {
      const r = await postMessage({ channelId, body: text.trim(), replyTo: replyTo?.id ?? null, clientId, photoUrl: kind === "photo" ? url : null, gifUrl: kind === "gif" ? url : null });
      if (!r.ok) toast(r.message ?? "Could not send", "error");
      else { setText(""); setReplyTo(null); }
    });
  };

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const supabase = getBrowserClient();
      const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from("chat-photos").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("chat-photos").getPublicUrl(path);
      await sendMedia("photo", data.publicUrl);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!gifOpen) return;
    let active = true;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/gifs?q=${encodeURIComponent(gifQuery)}`);
      const json = (await res.json()) as { results: typeof gifs };
      if (active) setGifs(json.results ?? []);
    }, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifOpen, gifQuery]);

  const onText = (v: string) => {
    setText(v);
    const m = v.match(/@([\w .'-]{1,30})$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  };
  const mentionMatches = mentionQuery !== null ? mentionables.filter((p) => p.name.toLowerCase().includes(mentionQuery) || (p.nick ?? "").toLowerCase().includes(mentionQuery)).slice(0, 6) : [];
  const pickMention = (p: { name: string }) => { setText((t) => t.replace(/@([\w .'-]{1,30})$/, `@${p.name} `)); setMentionQuery(null); inputRef.current?.focus(); };

  const canEdit = (m: ChatMessage) => m.authorId === me.id && new Date().getTime() - new Date(m.createdAt).getTime() < 5 * 60_000;
  const byId = new Map(messages.map((m) => [m.id, m]));
  const muted = mutedUntil && new Date(mutedUntil) > new Date();

  const renderBody = (body: string) => body.split(/(@[\w][\w .'-]{0,30}?)(?=\s|$|[,.!?])/g).map((part, i) => {
    if (part.startsWith("@") && mentionables.some((p) => `@${p.name}` === part || `@${p.nick}` === part)) return <span key={i} className="font-semibold text-accent">{part}</span>;
    return <span key={i}>{part}</span>;
  });

  const withDays = messages.map((m, i) => ({ m, showDay: i === 0 || fmtDate(messages[i - 1].createdAt) !== fmtDate(m.createdAt) }));
  return (
    <>
      {rules && <p className="border-b border-border bg-elev-2 px-3 py-1.5 text-xs text-muted">📌 {rules}</p>}
      <div className="flex-1 overflow-y-auto px-3 py-2" role="log" aria-live="polite">
        {withDays.map(({ m, showDay }) => {
          const day = fmtDate(m.createdAt);
          const mine = m.authorId === me.id;
          const parent = m.replyTo ? byId.get(m.replyTo) : null;
          const grouped = m.reactions.reduce<Record<string, string[]>>((acc, r) => { (acc[r.emoji] ??= []).push(r.player_id); return acc; }, {});
          return (
            <div key={m.id} id={`m-${m.id}`}>
              {showDay && <p className="my-2 text-center text-[11px] font-semibold uppercase text-subtle">{isToday(m.createdAt) ? "Today" : day}</p>}
              <div className={`group my-1 flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && (m.isBot ? <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm" aria-hidden>🤖</span> : <Avatar name={m.authorName} src={m.authorAvatar} size={32} className="mt-1" />)}
                <div className={`max-w-[82%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`rounded-2xl px-3 py-2 ${m.isBot ? "border border-accent/40 bg-accent-soft" : mine ? "bg-primary text-primary-fg" : "bg-elev-2"} ${m.pending ? "opacity-60" : ""}`}>
                    {!mine && <p className={`text-[11px] font-bold ${m.isBot ? "text-accent" : "text-subtle"}`}>{m.authorName}</p>}
                    {parent && <p className="mb-1 border-l-2 border-accent pl-2 text-xs opacity-80"><span className="font-semibold">{parent.authorName}:</span> {parent.deletedAt ? "[deleted]" : parent.body.slice(0, 80) || "📷"}</p>}
                    {m.deletedAt ? <p className="text-sm italic opacity-60">Message deleted</p> : (
                      <>
                        {m.photoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.photoUrl} alt="Shared photo" className="mb-1 max-h-72 rounded-lg" loading="lazy" />}
                        {m.gifUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.gifUrl} alt="GIF" className="mb-1 max-h-60 rounded-lg" loading="lazy" />}
                        {m.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{renderBody(m.body)}</p>}
                      </>
                    )}
                    <p className={`mt-0.5 text-[10px] ${mine && !m.isBot ? "text-primary-fg/70" : "text-subtle"}`}>{fmtTime(m.createdAt)}{m.editedAt ? " · edited" : ""}</p>
                  </div>
                  {Object.keys(grouped).length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {Object.entries(grouped).map(([emoji, ids]) => (
                        <button key={emoji} type="button" className={`rounded-full border px-2 py-0.5 text-xs ${ids.includes(me.id) ? "border-accent bg-accent-soft" : "border-border bg-elev"}`} onClick={() => start(async () => { await toggleReaction(m.id, emoji); })} aria-label={`${emoji} ${ids.length}`}>{emoji} {ids.length}</button>
                      ))}
                    </div>
                  )}
                  {!m.deletedAt && !m.pending && (
                    <div className="mt-0.5 flex gap-0.5 text-subtle">
                      <button type="button" className="tap !min-h-[36px] !min-w-[36px] flex items-center justify-center rounded-full" aria-label="React" onClick={() => setReactFor(reactFor === m.id ? null : m.id)}><Smile className="h-4 w-4" /></button>
                      <button type="button" className="tap !min-h-[36px] !min-w-[36px] flex items-center justify-center rounded-full" aria-label="Reply" onClick={() => { setReplyTo(m); inputRef.current?.focus(); }}><Reply className="h-4 w-4" /></button>
                      {canEdit(m) && <button type="button" className="tap !min-h-[36px] !min-w-[36px] flex items-center justify-center rounded-full" aria-label="Edit" onClick={() => { setEditing(m); setText(m.body); inputRef.current?.focus(); }}><Pencil className="h-4 w-4" /></button>}
                      {(mine || me.isAdmin) && !m.isBot && <button type="button" className="tap !min-h-[36px] !min-w-[36px] flex items-center justify-center rounded-full" aria-label="Delete" onClick={() => { if (confirm("Delete this message?")) start(async () => { const r = await deleteMessage(m.id); if (!r.ok) toast(r.message ?? "Failed", "error"); }); }}><Trash2 className="h-4 w-4" /></button>}
                      {!mine && !m.isBot && <button type="button" className="tap !min-h-[36px] !min-w-[36px] flex items-center justify-center rounded-full" aria-label="Report" onClick={() => { const reason = prompt("Why are you reporting this message?") ?? ""; if (reason !== null && reason.trim()) start(async () => { const r = await reportMessage(m.id, reason); toast(r.message ?? (r.ok ? "Reported" : "Failed"), r.ok ? "success" : "error"); }); }}><Flag className="h-4 w-4" /></button>}
                    </div>
                  )}
                  {reactFor === m.id && (
                    <div className="mt-1 flex gap-1 rounded-full bg-elev px-2 py-1 shadow-card">
                      {EMOJIS.map((e) => <button key={e} type="button" className="tap !min-h-[40px] !min-w-[40px] text-xl" onClick={() => { setReactFor(null); start(async () => { await toggleReaction(m.id, e); }); }} aria-label={`React ${e}`}>{e}</button>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-bg px-3 py-2 safe-bottom">
        {replyTo && <p className="mb-1 flex items-center justify-between rounded-lg bg-elev-2 px-2 py-1 text-xs"><span className="truncate">Replying to <span className="font-semibold">{replyTo.authorName}</span>: {replyTo.body.slice(0, 60)}</span><button type="button" className="tap !min-h-[32px] !min-w-[32px]" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></button></p>}
        {editing && <p className="mb-1 flex items-center justify-between rounded-lg bg-elev-2 px-2 py-1 text-xs"><span>Editing your message</span><button type="button" className="tap !min-h-[32px] !min-w-[32px]" aria-label="Cancel edit" onClick={() => { setEditing(null); setText(""); }}><X className="h-4 w-4" /></button></p>}
        {mentionMatches.length > 0 && (
          <ul className="mb-1 flex flex-wrap gap-1">{mentionMatches.map((p) => <li key={p.id}><button type="button" className="chip bg-accent-soft text-accent" onClick={() => pickMention(p)}><AtSign className="h-3 w-3" />{p.name}</button></li>)}</ul>
        )}
        {muted ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">You&apos;re muted until {fmtTime(mutedUntil!)}.</p> : (
          <div className="flex items-end gap-1">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            <button type="button" className="tap flex items-center justify-center rounded-full text-muted" aria-label="Send a photo" disabled={uploading} onClick={() => fileRef.current?.click()}><ImageIcon className="h-6 w-6" /></button>
            {gifsEnabled && <button type="button" className="tap flex items-center justify-center rounded-full text-muted" aria-label="Send a GIF" onClick={() => setGifOpen((o) => !o)}><Film className="h-6 w-6" /></button>}
            <textarea ref={inputRef} rows={1} className="input max-h-32 min-h-[48px] flex-1 resize-none py-3" placeholder="Talk your trash…" value={text} onChange={(e) => onText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Message" />
            <button type="button" className="btn btn-primary !min-h-[48px] !min-w-[48px] !px-0" aria-label="Send" onClick={send} disabled={pending || (!text.trim() && !editing)}><Send className="h-5 w-5" /></button>
            <button type="button" className="tap flex items-center justify-center rounded-full text-muted" aria-label={`Notifications: ${notif}`} title="Notifications for this channel" onClick={() => { const next = notif === "all" ? "mentions" : notif === "mentions" ? "off" : "all"; setNotif(next); start(async () => { await setChannelMode(channelId, next); toast(`Notifications: ${next === "all" ? "every message" : next === "mentions" ? "mentions only" : "off"}`); }); }}>{notif === "off" ? <BellOff className="h-5 w-5" /> : <Bell className={`h-5 w-5 ${notif === "all" ? "text-accent" : ""}`} />}</button>
          </div>
        )}
        {uploading && <p className="mt-1 text-xs text-muted">Compressing and uploading…</p>}
        {gifOpen && (
          <div className="mt-2 rounded-xl border border-border bg-elev p-2">
            <input className="input !min-h-[40px]" placeholder="Search GIFs" value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} />
            <div className="mt-2 grid max-h-48 grid-cols-3 gap-1 overflow-y-auto">
              {gifs.map((g) => /* eslint-disable-next-line @next/next/no-img-element */ <button key={g.id} type="button" onClick={() => { setGifOpen(false); sendMedia("gif", g.url); }} aria-label={g.title || "GIF"}><img src={g.preview} alt="" className="h-24 w-full rounded object-cover" /></button>)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
