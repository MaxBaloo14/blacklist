import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/supabase/server";
import { getBlacklistLive } from "@/lib/data";

export const dynamic = "force-dynamic";

// Données 100 % publiques (vues et tables en lecture seule) : aucune information privée.
export async function GET() {
  if (!hasSupabase) return NextResponse.json([]);
  const data = await getBlacklistLive();
  if (!data.length) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" } });
}
