"use client";
import { useActionState, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { updateProfile } from "@/lib/actions/profile";
import { getBrowserClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/util/image";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/team";

export function ProfileForm({ player }: { player: { id: string; display_name: string; nickname: string | null; bio: string | null; avatar_url: string | null } }) {
  const [state, action, pending] = useActionState(updateProfile, { ok: false } as ActionState);
  const [avatar, setAvatar] = useState(player.avatar_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const blob = await compressImage(file, 512, 0.85);
      const supabase = getBrowserClient();
      const path = `${player.id}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatar(data.publicUrl);
      toast("Photo uploaded — tap Save", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };
  return (
    <form action={action} className="card mt-4 flex flex-col gap-3 p-4">
      <input type="hidden" name="avatar_url" value={avatar ?? ""} />
      <div className="flex items-center gap-4">
        <Avatar name={player.display_name} src={avatar} size={72} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <button type="button" className="btn btn-soft" onClick={() => fileRef.current?.click()} disabled={uploading}><Camera className="h-5 w-5" /> {uploading ? "Uploading…" : "Change photo"}</button>
      </div>
      <label className="text-sm font-semibold" htmlFor="display_name">Name</label>
      <input id="display_name" name="display_name" className="input" defaultValue={player.display_name} required maxLength={40} />
      <label className="text-sm font-semibold" htmlFor="nickname">Nickname</label>
      <input id="nickname" name="nickname" className="input" defaultValue={player.nickname ?? ""} maxLength={30} placeholder="“Hanger”" />
      <label className="text-sm font-semibold" htmlFor="bio">Bio</label>
      <textarea id="bio" name="bio" className="input" rows={2} defaultValue={player.bio ?? ""} maxLength={200} placeholder="Weight of choice, years in the league, hot takes…" />
      {state.message && <p className={`text-sm font-semibold ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
