"use client";
import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { createTrackVideoUpload } from "@/app/actions/admin";
import { useT } from "@/components/LangProvider";

const MAX = 20 * 1024 * 1024;

/** Envoi d'une vidéo de circuit directement vers le stockage (l'hébergeur limite les envois via le site à ~4,5 Mo). */
export default function VideoUpload({ current }: { current?: string | null }) {
  const t = useT();
  const [path, setPath] = useState<string>("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    setPath("");
    if (!file) return setState({ kind: "idle" });
    if (file.size > MAX) return setState({ kind: "error", msg: t("Vidéo trop lourde (20 Mo maximum).") });
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const mp4 = head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70;           // "ftyp"
    const webm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;          // EBML
    if (!mp4 && !webm) return setState({ kind: "error", msg: t("Format non supporté (MP4 ou WebM).") });
    setState({ kind: "busy", msg: t("Envoi de la vidéo…") });
    const res = await createTrackVideoUpload(mp4 ? "mp4" : "webm");
    if (!res.ok || !res.path || !res.token) return setState({ kind: "error", msg: res.message ?? t("Envoi impossible.") });
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await sb.storage.from("track-images").uploadToSignedUrl(res.path, res.token, file, { contentType: mp4 ? "video/mp4" : "video/webm" });
    if (error) return setState({ kind: "error", msg: t("Envoi de la vidéo impossible.") });
    setPath(res.path);
    setState({ kind: "done", msg: t("Vidéo prête : enregistre le circuit pour la publier.") });
  }

  return (
    <div className="sm:col-span-2">
      <span className="label">{t("Vidéo du circuit (facultatif)")}</span>
      <input ref={input} type="file" accept="video/mp4,video/webm" onChange={(e) => pick(e.target.files?.[0])} className="input file:mr-3 file:border-0 file:bg-red file:px-3 file:py-1 file:font-cond file:text-xs file:font-bold file:uppercase file:text-white" />
      <input type="hidden" name="video_path" value={path} />
      <span className="hint block">{t("Courte vidéo muette en boucle : MP4 ou WebM, 5 à 20 secondes, 20 Mo maximum. Elle remplace le tracé animé.")}</span>
      {current && !path && (
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="remove_video" className="accent-[#c62828]" /> {t("Supprimer la vidéo actuelle")}</label>
      )}
      {state.msg && <p role="status" className={`mt-2 text-sm ${state.kind === "error" ? "text-[#ff6b6b]" : state.kind === "done" ? "text-ok" : "text-metal"}`}>{state.msg}</p>}
    </div>
  );
}
