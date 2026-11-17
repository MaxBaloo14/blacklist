import Link from "next/link";
import { getT } from "@/lib/i18n";

export default async function Footer() {
  const t = await getT();
  return (
    <footer className="border-t border-white/10 bg-[#06070a] py-14 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/logo.webp" alt="Booboo Crew" width={144} height={144} loading="lazy" className="mx-auto mb-4 w-36" style={{ maskImage: "radial-gradient(circle,#000 55%,transparent 72%)", WebkitMaskImage: "radial-gradient(circle,#000 55%,transparent 72%)" }} />
      <div className="font-cond text-sm tracking-[.5em] text-[#cfcfcf]">A <b className="text-red">BOOBOO CREW</b> PRODUCTION.</div>
      <div className="font-marker mt-2.5 text-lg text-metal">Blacklist — there is no second place.</div>
      <div className="font-cond mt-6 flex flex-wrap justify-center gap-x-7 gap-y-2 text-xs tracking-[.2em] text-metal">
        <Link href="/blacklist" className="hover:text-white">{t("LA BLACKLIST")}</Link>
        <Link href="/race-network" className="hover:text-white">{t("CIRCUITS")}</Link>
        <Link href="/warmup" className="hover:text-white">WARM-UP RACE</Link>
        <Link href="/crew" className="hover:text-white">{t("LE CREW")}</Link>
        <Link href="/admin/login" className="hover:text-white">{t("ORGANISATION")}</Link>
      </div>
    </footer>
  );
}
