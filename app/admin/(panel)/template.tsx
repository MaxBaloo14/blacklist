"use client";
import { motion } from "framer-motion";

/** Transition entre les pages : léger fondu + montée, et un trait rouge qui balaie le haut de l'écran. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="route-sweep" aria-hidden />
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: [0.2, 0.7, 0.2, 1] }}>
        {children}
      </motion.div>
    </>
  );
}
