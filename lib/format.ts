const TZ = "Europe/Paris";

export const money = (n: number | string | null | undefined, locale = "fr-FR") =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(n ?? 0)).replace(/[\u202f\u00a0]/g, " ") + " $";

export const dateTime = (d?: string | null, locale = "fr-FR") =>
  d ? new Intl.DateTimeFormat(locale, { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";

export const dateOnly = (d?: string | null, locale = "fr-FR") =>
  d ? new Intl.DateTimeFormat(locale, { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)) : "—";

export const fullName = (p?: { first_name?: string; last_name?: string } | null) => (p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "—");

export function photoUrl(path?: string | null, bucket = "vehicle-photos") {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** Image d'un circuit : un chemin commençant par « / » est un fichier du site (public/img/…), sinon un fichier du stockage. */
export function trackImageUrl(path?: string | null) {
  if (!path) return null;
  return path.startsWith("/") ? path : photoUrl(path, "track-images");
}
export const kmLabel = (v: unknown) => (v === null || v === undefined || v === "" || Number(v) <= 0 ? "—" : `${Number(v)} km`);

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

export const points = (n: number | string | null | undefined, locale = "fr-FR") =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(n ?? 0)).replace(/[  ]/g, " ") + " pts";

/** Jours proposables pour un créneau de duel : d'aujourd'hui (heure de Paris) jusqu'au dimanche de la semaine en cours. */
export function weekSlotDays(locale = "fr-FR"): { value: string; label: string }[] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const base = Date.UTC(g("year"), g("month") - 1, g("day"));
  const left = (7 - new Date(base).getUTCDay()) % 7;   // jours restants jusqu'au dimanche
  const fmt = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" });
  return Array.from({ length: left + 1 }, (_, i) => {
    const d = new Date(base + i * 864e5);
    return { value: d.toISOString().slice(0, 10), label: fmt.format(d) };
  });
}
export const SLOT_TIMES = ["21:00", "21:30", "22:00", "22:30", "23:00", "23:30"];
