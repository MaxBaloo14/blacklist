import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PRIVATE = ["/profile", "/challenges", "/notifications"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Rafraîchit la session si besoin et vérifie le jeton localement (pas d'aller-retour réseau à chaque page)
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const path = request.nextUrl.pathname;
  if (!user) {
    if (path.startsWith("/admin") && path !== "/admin/login") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (PRIVATE.some((p) => path === p || path.startsWith(p + "/"))) {
      const to = new URL("/login", request.url);
      to.searchParams.set("next", path);
      return NextResponse.redirect(to);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|img/|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)"],
};
