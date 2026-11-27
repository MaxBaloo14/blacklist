"use client";
import { useState } from "react";
import { CarFront } from "lucide-react";

/** Photo d'un véhicule de la liste (servie par ce site). Sans photo, ou si elle ne charge pas : icône de voiture. */
export default function CarThumb({ slug, className = "", iconSize = 22 }: { slug?: string | null; className?: string; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`car-thumb ${className}`} aria-hidden>
      {slug && !failed
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/api/vehicle-img/${slug}`} alt="" loading="lazy" decoding="async" width={480} height={300} onError={() => setFailed(true)} />
        : <CarFront size={iconSize} strokeWidth={1.4} />}
    </span>
  );
}
