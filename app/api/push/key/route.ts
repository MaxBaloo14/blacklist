import { NextResponse } from "next/server";
import { getVapid } from "@/lib/push";

export const dynamic = "force-dynamic";
// Clé publique (non secrète) nécessaire au navigateur pour s'abonner.
export async function GET() {
  try { return NextResponse.json({ publicKey: (await getVapid()).publicKey }, { headers: { "Cache-Control": "public, max-age=300" } }); }
  catch { return NextResponse.json({ error: "unavailable" }, { status: 503 }); }
}
