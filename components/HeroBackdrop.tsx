"use client";
import { motion, useScroll, useTransform } from "framer-motion";

/** Fond de l'accueil : très léger effet de profondeur au défilement (parallaxe). */
export default function HeroBackdrop() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 90]);
  return (
    <motion.div aria-hidden style={{ y }} className="absolute inset-x-0 -bottom-24 top-0 -z-20">
      <div className="push-in hero-bg size-full bg-cover bg-[position:center_30%]" />
    </motion.div>
  );
}
