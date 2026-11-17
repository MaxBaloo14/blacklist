"use client";
import { useEffect, useRef, useState } from "react";
import TrackMap from "@/components/TrackMap";

/**
 * Média d'un circuit : petite vidéo muette en boucle (lue seulement quand la carte est visible),
 * avec le tracé animé en secours si la vidéo ne peut pas être lue ou si l'utilisateur a réduit les animations.
 */
export default function TrackMedia({ id, name, videoUrl, posterUrl, loop, active, dur }: { id: string; name: string; videoUrl: string; posterUrl?: string | null; loop: boolean; active: boolean; dur: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    const v = ref.current;
    if (!v || reduced || !active) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => setFailed(true)); else v.pause(); }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, [reduced, active, failed]);

  if (failed) return <TrackMap id={id} name={name} loop={loop} active={active} dur={dur} />;
  return (
    <video ref={ref} muted loop playsInline preload="metadata" poster={posterUrl ?? undefined} aria-label={name} onError={() => setFailed(true)}
      className={`block size-full object-cover ${active ? "" : "grayscale opacity-70"}`}>
      <source src={videoUrl} />
    </video>
  );
}
