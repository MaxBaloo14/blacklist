import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Splash from "@/components/Splash";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Splash />
      <Nav />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
