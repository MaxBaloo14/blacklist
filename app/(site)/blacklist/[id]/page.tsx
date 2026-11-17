import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DriverSheet from "@/components/DriverSheet";
import { getDriverDuels, getDriverMoves, getPublicDriver } from "@/lib/data";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = uuid.test(id) ? await getPublicDriver(id) : null;
  return { title: d ? `${d.first_name} ${d.last_name}` : "Pilote" };
}

export default async function DriverPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const [d, duels, moves] = await Promise.all([getPublicDriver(id), getDriverDuels(id), getDriverMoves(id)]);
  if (!d) notFound();
  return <DriverSheet d={d} duels={duels} moves={moves} />;
}
