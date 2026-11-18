import { NextResponse } from "next/server";
import { createClient, hasSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Contrôle de santé : interroge réellement la base (sans cache). Sert au ping anti-pause de Supabase et à la surveillance du site.
export async function GET() {
  if (!hasSupabase) return NextResponse.json({ ok: false, db: "non configurée" }, { status: 503 });
  try {
    const supabase = await createClient();
    const { count, error } = await supabase.from("blacklist_rankings").select("position", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, db: "ok", positions: count, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, db: "injoignable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
