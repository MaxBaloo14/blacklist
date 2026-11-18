import type { Metadata } from "next";
import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import ChallengesPanel from "@/components/ChallengesPanel";
import JourneyPanel from "@/components/JourneyPanel";
import DuelCard from "@/components/DuelCard";
import Field from "@/components/Field";
import PageHead from "@/components/PageHead";
import { BadgeGrid } from "@/components/PilotBadges";
import Tabs from "@/components/Tabs";
import { cancelProposal, proposeVehicle, updateProfile } from "@/app/actions/driver";
import { requireDriver } from "@/lib/auth";
import { badgeCatalog } from "@/lib/badges";
import { bestRank } from "@/lib/driver-stats";
import { getPublicSettings, getTracks, getWarmups } from "@/lib/data";
import { dateOnly, dateTime, money, photoUrl } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { localizeReason } from "@/lib/notif-i18n";
import type { Row } from "@/lib/types";

export const metadata: Metadata = { title: "Mon profil" };

export default async function Profile({ searchParams }: { searchParams: Promise<{ tab?: string; welcome?: string }> }) {
  const [sp, { t, lang, locale }] = await Promise.all([searchParams, getI18n()]);
  const TABS: [string, string][] = [["overview", t("APERÇU")], ["challenges", t("DÉFIS")], ["history", t("HISTORIQUE")], ["rewards", t("RÉCOMPENSES")], ["garage", "GARAGE"], ["badges", "BADGES"]];
  const VSTATUS: Record<string, [string, string]> = {
    pending: [t("En attente d'homologation"), "badge-warn"], approved: [t("Homologué"), "badge-ok"], rejected: [t("Refusé"), "badge-red"],
    disqualified: [t("Véhicule disqualifié"), "badge-red"], lost: [t("Perdu"), "badge-red"], replaced: [t("Remplacé"), "badge-metal"],
  };
  const REG: Record<string, string> = { pending: t("en attente"), validated: t("validée"), rejected: t("refusée") };
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const { supabase, user, profile } = await requireDriver();
  const uid = user.id;

  const [{ data: rank }, { data: stats }, { data: vehicles }, { data: rewards }, { data: duels }, { data: moves }, tracks, settings, { data: inact }, { data: activeCh }, warmups] = await Promise.all([
    supabase.from("blacklist_rankings").select("position").eq("driver_id", uid).maybeSingle(),
    supabase.from("driver_stats").select("*").eq("driver_id", uid).maybeSingle(),
    supabase.from("vehicles").select("*").eq("owner_id", uid).order("created_at", { ascending: false }),
    supabase.from("rewards").select("*, reward_payments(paid_at)").eq("driver_id", uid).order("created_at", { ascending: false }),
    supabase.from("public_duels").select("*").or(`challenger_id.eq.${uid},defender_id.eq.${uid}`).order("scheduled_at", { ascending: false, nullsFirst: false }),
    supabase.from("ranking_history").select("*").eq("driver_id", uid).order("created_at", { ascending: false }).limit(20),
    getTracks(), getPublicSettings(), supabase.rpc("inactivity_days", { p_driver: uid }),
    supabase.from("challenges").select("id").in("status", ["awaiting_schedule", "scheduled", "awaiting_validation"]).limit(1),
    getWarmups(),
  ]);
  const nextWarmup = warmups.filter((w) => ["scheduled", "running"].includes(w.status)).sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0] ?? null;
  const myPos: number | null = rank?.position ?? null;
  const current = vehicles?.find((v) => v.status === "approved");
  const pending = vehicles?.find((v) => v.status === "pending");
  const cashTotal = (rewards ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const cashPaid = (rewards ?? []).filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
  const days: number | null = myPos ? (inact ?? 0) : null;
  const limit: number = Number(settings.find((s) => s.key === "inactivity_days")?.value ?? 14);
  const forbidden = (settings.find((s) => s.key === "forbidden_vehicle_classes")?.value ?? []) as string[];
  const classes = ((settings.find((s) => s.key === "vehicle_classes")?.value ?? []) as string[]).filter((c) => !forbidden.includes(c));
  const ready = !current ? (pending ? t("Ton véhicule est en attente d'homologation.") : t("Aucun véhicule homologué.")) : profile.registration_status !== "validated" ? t("Ton inscription n'est pas encore validée.") : null;
  const lastVeh = vehicles?.find((v) => v.status === "rejected" && !pending);
  const m = (n: number | string) => money(n, locale);
  const paidCount = (rewards ?? []).filter((r) => r.status === "paid").length;
  const catalog = badgeCatalog({
    driverId: uid, position: myPos, best: bestRank(myPos, moves ?? []), wins: stats?.wins ?? 0, losses: stats?.losses ?? 0, challengesWon: stats?.challenges_won ?? 0, duels: duels ?? [],
    registered: profile.registration_status === "validated", vehicle: Boolean(current), rewardsPaid: paidCount, warmupWinner: Boolean(profile.entry_eligible) || (moves ?? []).some((x) => x.kind === "entry"),
  }, t);
  const earnedCount = catalog.filter((b) => b.earned).length;

  return (
    <>
      <PageHead kicker={myPos ? `BLACKLIST #${myPos}` : t("ESPACE PILOTE")} title={profile.first_name} em={profile.last_name} />
      <section className="py-10">
        <div className="wrap">
          {sp.welcome && <p className="panel mb-6 text-[15px]"><b className="text-red">{t("Bienvenue dans le réseau.")}</b> {t("Ton dossier est en cours d'examen par l'organisation : tu seras notifié dès que ton inscription et ton véhicule seront validés.")}</p>}
          <Tabs base="/profile" tabs={TABS} current={tab} />

          {tab === "badges" && (
            <div>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div><div className="kicker mb-1.5">{t("MES BADGES")}</div><h2 className="h2 !text-[clamp(28px,3.5vw,42px)]">{earnedCount} / {catalog.length} <em>{t("obtenus")}</em></h2></div>
                <p className="max-w-md text-sm text-[#a5a9b0]">{t("Les badges se débloquent automatiquement selon tes duels, ton classement et ton dossier.")}</p>
              </div>
              <BadgeGrid badges={[...catalog].sort((a, b) => Number(b.earned) - Number(a.earned))} earnedLabel={t("OBTENU")} lockedLabel={t("À DÉBLOQUER")} />
            </div>
          )}

          {tab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="grid gap-6">
                <JourneyPanel profile={profile} current={current} pending={pending} myPos={myPos} active={activeCh?.[0] ?? null} nextWarmup={nextWarmup} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[["Position", myPos ? `#${myPos}` : "—", "text-red"], [t("Victoires"), stats?.wins ?? 0, "text-ok"], [t("Défaites"), stats?.losses ?? 0, "text-red"], [t("Défis remportés"), stats?.challenges_won ?? 0, "text-bone"]].map(([l, v, c]) => (
                    <div key={l as string} className="bg-ink2 p-5 text-center"><div className={`font-display text-4xl ${c}`}>{v}</div><div className="label mt-1">{l}</div></div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="panel-flat"><div className="label">{t("Cash Prize total gagné")}</div><div className="font-display text-4xl">{m(cashTotal)}</div><div className="font-cond text-sm tracking-wide text-metal">{t("dont {x} déjà versés", { x: m(cashPaid) })}</div></div>
                  <div className="panel-flat"><div className="label">{t("Dernière activité")}</div><div className="font-cond text-xl tracking-wide">{dateTime(profile.last_activity_at, locale)}</div>
                    {days !== null && <div className={`mt-1 text-sm ${days >= limit ? "text-[#ff6b6b]" : "text-metal"}`}>{t("{n} jour(s) sans duel officiel", { n: days })} {days >= limit && `— ${t("attention : seuil atteint")}`}</div>}</div>
                </div>
                <div className="panel-flat flex flex-wrap items-center gap-4">
                  <div className="label !mb-0">{t("Statuts")}</div>
                  <span className={`badge ${profile.registration_status === "validated" ? "badge-ok" : profile.registration_status === "rejected" ? "badge-red" : "badge-warn"}`}>{t("Inscription")} : {REG[profile.registration_status]}</span>
                  <span className={`badge ${current ? "badge-ok" : "badge-warn"}`}>{t("Véhicule")} : {current ? VSTATUS.approved[0] : pending ? VSTATUS.pending[0] : t("aucun")}</span>
                  {profile.account_status !== "active" && <span className="badge badge-red">{t("Compte")} : {profile.account_status}</span>}
                  {profile.entry_eligible && <span className="badge badge-ok">{t("Éligible au #10")}</span>}
                </div>
                {profile.registration_note && <p className="panel-flat text-sm text-[#a5a9b0]"><b className="text-bone">{t("Note de l'organisation :")}</b> {profile.registration_note}</p>}
              </div>

              <ActionForm action={updateProfile} label="ENREGISTRER" reset={false} className="panel">
                <div className="kicker mb-4">{t("MES INFORMATIONS")}</div>
                <div className="grid gap-4">
                  <Field label={t("Prénom")}><input name="first_name" defaultValue={profile.first_name} required maxLength={60} className="input" /></Field>
                  <Field label={t("Nom")}><input name="last_name" defaultValue={profile.last_name} required maxLength={60} className="input" /></Field>
                  <Field label={t("Téléphone")} hint={t("C'est ton identifiant de connexion.")}><input name="phone" type="tel" defaultValue={profile.phone} required maxLength={30} className="input" /></Field>
                  <Field label={t("Pseudo Discord (facultatif)")}><input name="discord_tag" defaultValue={profile.discord_tag ?? ""} maxLength={40} className="input" /></Field>
                  <Field label={t("IBAN bancaire")} hint={t("Compte sur lequel l'organisation te verse ton Cash Prize. Visible uniquement par toi et l'organisation.")}><input name="bank_iban" defaultValue={profile.bank_iban ?? ""} maxLength={40} autoComplete="off" spellCheck={false} placeholder="XX00 0000 0000" className="input font-mono tracking-wider" /></Field>
                </div>
              </ActionForm>

            </div>
          )}

          {tab === "challenges" && <ChallengesPanel supabase={supabase} userId={uid} myPos={myPos} ready={ready} tracks={tracks} />}

          {tab === "history" && (
            <div className="grid gap-10">
              <div>
                <div className="kicker mb-3">{t("CONFRONTATIONS")}</div>
                {duels?.length ? <div className="grid gap-4 md:grid-cols-3">{duels.map((d) => <DuelCard key={d.id} d={d} />)}</div> : <p className="panel text-[#a5a9b0]">{t("Aucune course pour le moment.")}</p>}
              </div>
              <div>
                <div className="kicker mb-3">{t("MOUVEMENTS DANS LA BLACKLIST")}</div>
                {moves?.length ? (
                  <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>Date</th><th>{t("De")}</th><th>{t("Vers")}</th><th>{t("Motif")}</th></tr></thead><tbody>
                    {moves.map((mv) => <tr key={mv.id}><td className="whitespace-nowrap">{dateTime(mv.created_at, locale)}</td><td>{mv.from_position ? `#${mv.from_position}` : "—"}</td><td>{mv.to_position ? `#${mv.to_position}` : t("Hors classement")}</td><td className="text-[#a5a9b0]">{localizeReason(mv.reason, lang)}</td></tr>)}
                  </tbody></table></div>
                ) : <p className="panel text-[#a5a9b0]">{t("Aucun mouvement.")}</p>}
              </div>
            </div>
          )}

          {tab === "rewards" && (
            <div>
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="panel-flat"><div className="label">{t("Total gagné")}</div><div className="font-display text-4xl">{m(cashTotal)}</div></div>
                <div className="panel-flat"><div className="label">{t("Versé")}</div><div className="font-display text-4xl text-ok">{m(cashPaid)}</div></div>
                <div className="panel-flat"><div className="label">{t("En attente")}</div><div className="font-display text-4xl text-red">{m(cashTotal - cashPaid)}</div></div>
              </div>
              {!profile.bank_iban && (
                <p className="panel mb-6 text-[15px]"><b className="text-red">{t("IBAN manquant.")}</b> {t("Renseigne ton IBAN bancaire pour recevoir ton Cash Prize.")} <Link href="/profile?tab=overview" className="text-red underline underline-offset-4 hover:text-white">{t("Ajouter mon IBAN")}</Link></p>
              )}
              {rewards?.length ? (
                <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>Date</th><th>{t("Boss battu")}</th><th>{t("Montant")}</th><th>{t("Statut")}</th><th>{t("Versé le")}</th><th>Clip</th></tr></thead><tbody>
                  {rewards.map((r: Row) => (
                    <tr key={r.id}><td>{dateOnly(r.created_at, locale)}</td><td>#{r.rank_beaten}</td><td className="font-cond text-lg font-bold">{m(r.amount)}</td>
                      <td><span className={`badge ${r.status === "paid" ? "badge-ok" : "badge-warn"}`}>{r.status === "paid" ? t("Versé") : t("En attente")}</span></td>
                      <td>{r.reward_payments ? dateOnly((Array.isArray(r.reward_payments) ? r.reward_payments[0] : r.reward_payments)?.paid_at, locale) : "—"}</td>
                      <td>{r.clip_url ? <a href={r.clip_url} target="_blank" rel="noopener noreferrer" className="text-red hover:text-white">{t("Voir")}</a> : "—"}</td></tr>
                  ))}
                </tbody></table></div>
              ) : <p className="panel text-[#a5a9b0]">{t("Aucune récompense. Bats un pilote de la Blacklist pour remporter son Cash Prize.")}</p>}
              <p className="mt-4 text-xs text-metal">{t("Le site ne réalise aucun transfert d'argent : il suit uniquement les versements effectués par l'organisation.")}</p>
            </div>
          )}

          {tab === "garage" && (
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div className="grid content-start gap-5">
                <div className="kicker">{t("VÉHICULE ENGAGÉ")}</div>
                {current ? (
                  <div className="overflow-hidden border border-white/10 bg-ink2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {current.photo_path ? <img src={photoUrl(current.photo_path)!} alt="" className="aspect-video w-full object-cover" /> : <div className="grid aspect-video w-full place-items-center bg-ink3 font-cond text-xs tracking-[.3em] text-metal">{t("PAS DE PHOTO")}</div>}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="font-cond text-2xl font-bold uppercase tracking-wide">{current.make_model}<div className="text-sm font-normal text-metal">{t(current.vehicle_class)}</div></div><span className="badge badge-ok">{VSTATUS.approved[0]}</span></div>
                  </div>
                ) : <p className="panel text-[#a5a9b0]">{t("Aucun véhicule homologué.")} {vehicles?.some((v) => v.status === "lost") && <b className="text-[#ff6b6b]">{t("Ton ancien véhicule a été confisqué : enregistre-en un nouveau et fais-le homologuer.")}</b>}</p>}
                {pending && (
                  <div className="panel">
                    <div className="mb-2 flex items-center justify-between"><div className="kicker">{t("DEMANDE EN COURS")}</div><span className="badge badge-warn">{VSTATUS.pending[0]}</span></div>
                    <div className="font-cond text-xl uppercase tracking-wide">{pending.make_model}</div>
                    <ActionForm action={cancelProposal} label="ANNULER LA DEMANDE" variant="ghost" small confirm="Annuler cette demande d'homologation ?" />
                  </div>
                )}
                {lastVeh && !pending && <p className="panel border-l-red text-sm"><b className="text-[#ff6b6b]">{t("Dernière demande refusée :")}</b> {lastVeh.make_model} — {lastVeh.rejection_reason}</p>}
                <div>
                  <div className="kicker mb-3">{t("HISTORIQUE DES VÉHICULES")}</div>
                  <ul className="grid gap-2">{vehicles?.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 bg-ink2 px-4 py-3"><span className="font-cond uppercase tracking-wide">{v.make_model} <span className="text-xs text-metal">· {dateOnly(v.created_at, locale)}</span></span><span className={`badge ${VSTATUS[v.status][1]}`}>{VSTATUS[v.status][0]}</span></li>
                  ))}</ul>
                </div>
              </div>
              <ActionForm action={proposeVehicle} label={pending ? "DEMANDE EN COURS" : current ? "PROPOSER UN CHANGEMENT" : "SOUMETTRE LE VÉHICULE"} className="panel content-start" confirm="Ce véhicule sera soumis à homologation. Ton véhicule actuel reste engagé jusqu'à la décision de l'organisation.">
                <div className="kicker mb-4">{current ? t("CHANGER DE VÉHICULE") : t("ENREGISTRER UN VÉHICULE")}</div>
                <fieldset disabled={!!pending} className="grid gap-4">
                  <Field label={t("Marque et modèle")}><input name="make_model" required maxLength={80} className="input" /></Field>
                  <Field label={t("Catégorie")}><select name="vehicle_class" required defaultValue="" className="input"><option value="" disabled>{t("Choisir…")}</option>{classes.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
                  <Field label={t("Photographie (facultatif)")} hint={t("JPEG, PNG ou WebP — 5 Mo max.")}><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input file:mr-3 file:border-0 file:bg-red file:px-3 file:py-1 file:font-cond file:text-xs file:font-bold file:uppercase file:text-white" /></Field>
                </fieldset>
              </ActionForm>
            </div>
          )}
          <div className="mt-12 text-xs text-metal">{t("Compte créé le {d}", { d: dateOnly(profile.created_at, locale) })} · <Link href="/notifications" className="text-red hover:text-white">{t("Voir mes notifications")}</Link></div>
        </div>
      </section>
    </>
  );
}
