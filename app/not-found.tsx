import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="relative flex min-h-screen items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10 bg-cover bg-center opacity-30" style={{ backgroundImage: "url(/img/hero.jpg)" }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/70 to-ink/90" />
        <div className="wrap">
          <div className="kicker mb-3">ERROR 404</div>
          <h1 className="font-display text-[clamp(90px,20vw,240px)] leading-[.85]">DEAD <span className="text-red">END</span></h1>
          <p className="font-marker slash my-6 text-3xl">Cette route n&apos;existe pas à Los Santos.</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/" className="btn btn-red">BACK TO THE STREETS</Link>
            <Link href="/blacklist" className="btn btn-ghost">VIEW THE LIST</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
