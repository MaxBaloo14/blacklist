import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Solde de zigollars du pilote connecté (la RLS ne renvoie que le sien).
export async function GET() {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return NextResponse.json({ balance: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { data } = await supabase.from("point_balances").select("balance,locked").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ balance: Number(data?.balance ?? 0), locked: Number(data?.locked ?? 0) }, { headers: { "Cache-Control": "no-store" } });
}
