import { NextResponse } from "next/server";
import { createClient, hasSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Données 100 % publiques (vue public_blacklist) : aucune information privée.
export async function GET() {
  if (!hasSupabase) return NextResponse.json([]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_blacklist").select("*").order("position");
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" } });
}
