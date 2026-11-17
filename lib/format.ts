const TZ = "Europe/Paris";

export const money = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(n ?? 0)).replace(/ | /g, " ") + " $";

export const dateTime = (d?: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";

export const dateOnly = (d?: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)) : "—";

export const fullName = (p?: { first_name?: string; last_name?: string } | null) => (p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "—");

export function photoUrl(path?: string | null, bucket = "vehicle-photos") {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export const rankLabel = (n?: number | null) => (n ? `#${n}` : "—");

/** valeur <input type=datetime-local> → ISO (heure de Paris) */
export function parisLocalToISO(local: string): string {
  // local = "2026-11-20T21:30" interprété en Europe/Paris
  const [d, t] = local.split("T");
  const guess = new Date(`${d}T${t}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asParis = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  const offset = asParis - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}
