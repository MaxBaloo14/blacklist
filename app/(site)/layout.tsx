import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BottomBar from "@/components/BottomBar";
import Splash from "@/components/Splash";
import { getT } from "@/lib/i18n";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <>
      <a href="#contenu" className="skip-link">{t("Aller au contenu")}</a>
      <Splash />
      <Nav />
      <div className="pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-0">
      <main id="contenu" tabIndex={-1} className="min-h-screen outline-none">{children}</main>
      <Footer />
      </div>
      <BottomBar />
    </>
  );
}
