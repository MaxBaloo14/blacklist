"use client";
import { useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { embedUrl, parseClip } from "@/lib/clips";

/** Bouton « Regarder le clip » : ouvre le clip dans une fenêtre, sans quitter le site. Rien n'est chargé chez le fournisseur avant le clic. */
export default function ClipButton({ url, title, className = "" }: { url: string; title?: string; className?: string }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const clip = parseClip(url);
  if (!clip) return <a href={url} target="_blank" rel="noopener noreferrer" className={`clip-btn ${className}`}>{t("CLIP")} →</a>;
  const close = () => { ref.current?.close(); setOpen(false); };
  return (
    <>
      <button type="button" className={`clip-btn ${className}`} onClick={() => { setOpen(true); ref.current?.showModal(); }}>
        <Play size={14} aria-hidden /> {t("REGARDER LE CLIP")}
      </button>
      <dialog ref={ref} className="clip-dialog" aria-label={title ?? t("Clip")} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) close(); }}>
        <div className="clip-frame">
          <button type="button" onClick={close} aria-label={t("Fermer")} className="clip-close"><X size={20} /></button>
          {open && (clip.provider === "file"
            ? <video src={clip.url} controls autoPlay playsInline className="size-full bg-black" />
            : <iframe src={embedUrl(clip, window.location.hostname)} title={title ?? t("Clip")} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" className="size-full border-0" />)}
        </div>
        <div className="font-cond flex items-center justify-between gap-3 px-4 py-2 text-xs tracking-[.16em] text-metal"><span>{clip.label}{title ? ` · ${title}` : ""}</span><a href={clip.url} target="_blank" rel="noopener noreferrer" className="text-[#cfcfcf] underline underline-offset-4 hover:text-white">{t("Ouvrir sur {site}", { site: clip.label })}</a></div>
      </dialog>
    </>
  );
}
