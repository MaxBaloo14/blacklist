import type { Metadata } from "next";
import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import ChallengesPanel from "@/components/ChallengesPanel";
import DuelCard from "@/components/DuelCard";
import Field from "@/components/Field";
import PageHead from "@/components/PageHead";
import Tabs from "@/components/Tabs";
import { cancelProposal, proposeVehicle, updateProfile } from "@/app/actions/driver";
import { requireDriver } from "@/lib/auth";
import { getPublicSettings, getTracks } from "@/lib/data";
import { dateOnly, dateTime, money, photoUrl } from "@/lib/format";
import type { Row } from "@/lib/types";

export const metadata: Metadata = { title: "My Profile" };
export const dynamic = "force-dynamic";

const TABS: [string, string][] = [["overview", "OVERVIEW"], ["challenges", "CHALLENGES"], ["history", "HISTORY"], ["rewards", "REWARDS"], ["garage", "GARAGE"]];
const VSTATUS: Record<string, [string, string]> = {
  pending: ["Pending Approval", "badge-warn"], approved: ["Approved", "badge-ok"], rejected: ["Rejected", "badge-red"],
  disqualified: ["Vehicle Disqualified", "badge-red"], lost: ["Lost", "badge-red"], replaced: ["Replaced", "badge-metal"],
};

export default async function Profile({ searchParams }: { searchParams: Promise<{ tab?: string; welcome?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const { supabase, user, profile } = await requireDriver();
  const uid = user.id;

  const [{ data: rank }, { data: stats }, { data: vehicles }, { data: rewards }, { data: duels }, { data: moves }, tracks, settings, { data: inact }] = await Promise.all([
    supabase.from("blacklist_rankings").select("position").eq("driver_id", uid).maybeSingle(),
    supabase.from("driver_stats").select("*").eq("driver_id", uid).maybeSingle(),
    supabase.from("vehicles").select("*").eq("owner_id", uid).order("created_at", { ascending: false }),
    supabase.from("rewards").select("*, reward_payments(paid_at)").eq("driver_id", uid).order("created_at", { ascending: false }),
    supabase.from("public_duels").select("*").or(`challenger_id.eq.${uid},defender_id.eq.${uid}`).order("scheduled_at", { ascending: false, nullsFirst: false }),
    supabase.from("ranking_history").select("*").eq("driver_id", uid).order("created_at", { ascending: false }).limit(20),
    getTracks(), getPublicSettings(), supabase.rpc("inactivity_days", { p_driver: uid }),
  ]);
  const myPos: number | null = rank?.position ?? null;
  const current = vehicles?.find((v) => v.status === "approved");
  const pending = vehicles?.find((v) => v.status === "pending");
  const cashTotal = (rewards ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const cashPaid = (rewards ?? []).filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
  const days: number | null = myPos ? (inact ?? 0) : null;
  const limit: number = Number(settings.find((s) => s.key === "inactivity_days")?.value ?? 14);
  const classes = ((settings.find((s) => s.key === "vehicle_classes")?.value ?? []) as string[]).filter((c) => !((settings.find((s) => s.key === "forbidden_vehicle_classes")?.value ?? []) as string[]).includes(c));
  const ready = !current ? (pending ? "Ton véhicule est en attente d'homologation." : "Aucun véhicule homologué.") : profile.registration_status !== "validated" ? "Ton inscription n'est pas encore validée." : null;
  const lastVeh = vehicles?.find((v) => v.status === "rejected" && !pending);

  return (
    <>
      <PageHead kicker={myPos ? `BLACKLIST #${myPos}` : "DRIVER SPACE"} title={profile.first_name} em={profile.last_name} />
      <section className="py-10">
        <div className="wrap">
          {sp.welcome && <p className="panel mb-6 text-[15px]"><b className="text-red">Bienvenue dans le réseau.</b> Ton dossier est en cours d&apos;examen par l&apos;organisation : tu seras notifié dès que ton inscription et ton véhicule seront validés.</p>}
          <Tabs base="/profile" tabs={TABS} current={tab} />

          {tab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[["Position", myPos ? `#${myPos}` : "—", "text-red"], ["Victoires", stats?.wins ?? 0, "text-ok"], ["Défaites", stats?.losses ?? 0, "text-red"], ["Défis remportés", stats?.challenges_won ?? 0, "text-bone"]].map(([l, v, c]) => (
                    <div key={l as string} className="bg-ink2 p-5 text-center"><div className={`font-display text-4xl ${c}`}>{v}</div><div className="label mt-1">{l}</div></div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="panel-flat"><div className="label">Cash Prize total gagné</div><div className="font-display text-4xl">{money(cashTotal)}</div><div className="font-cond text-sm tracking-wide text-metal">dont {money(cashPaid)} déjà versés</div></div>
                  <div className="panel-flat"><div className="label">Dernière activité</div><div className="font-cond text-xl tracking-wide">{dateTime(profile.last_activity_at)}</div>
                    {days !== null && <div className={`mt-1 text-sm ${days >= limit ? "text-[#ff6b6b]" : "text-metal"}`}>{days} jour(s) sans duel officiel {days >= limit && "— attention : seuil atteint"}</div>}</div>
                </div>
                <div className="panel-flat flex flex-wrap items-center gap-4">
                  <div className="label !mb-0">Statuts</div>
                  <span className={`badge ${profile.registration_status === "validated" ? "badge-ok" : profile.registration_status === "rejected" ? "badge-red" : "badge-warn"}`}>Inscription : {profile.registration_status}</span>
                  <span className={`badge ${current ? "badge-ok" : "badge-warn"}`}>Véhicule : {current ? "Approved" : pending ? "Pending Approval" : "aucun"}</span>
                  {profile.account_status !== "active" && <span className="badge badge-red">Compte : {profile.account_status}</span>}
                  {profile.entry_eligible && <span className="badge badge-ok">Éligible au #10</span>}
                </div>
                {profile.registration_note && <p className="panel-flat text-sm text-[#a5a9b0]"><b className="text-bone">Note de l&apos;organisation :</b> {profile.registration_note}</p>}
              </div>

              <ActionForm action={updateProfile} label="SAVE" reset={false} className="panel">
                <div className="kicker mb-4">MES INFORMATIONS</div>
                <div className="grid gap-4">
                  <Field label="Prénom"><input name="first_name" defaultValue={profile.first_name} required maxLength={60} className="input" /></Field>
                  <Field label="Nom"><input name="last_name" defaultValue={profile.last_name} required maxLength={60} className="input" /></Field>
                  <Field label="Téléphone"><input name="phone" type="tel" defaultValue={profile.phone} required maxLength={30} className="input" /></Field>
                  <Field label="Pseudo Discord"><input name="discord_tag" defaultValue={profile.discord_tag} required maxLength={40} className="input" /></Field>
                </div>
              </ActionForm>
            </div>
          )}

          {tab === "challenges" && <ChallengesPanel supabase={supabase} userId={uid} myPos={myPos} ready={ready} tracks={tracks} />}

          {tab === "history" && (
            <div className="grid gap-10">
              <div>
                <div className="kicker mb-3">CONFRONTATIONS</div>
                {duels?.length ? <div className="grid gap-4 md:grid-cols-3">{duels.map((d) => <DuelCard key={d.id} d={d} />)}</div> : <p className="panel text-[#a5a9b0]">Aucune course pour le moment.</p>}
              </div>
              <div>
                <div className="kicker mb-3">MOUVEMENTS DANS LA BLACKLIST</div>
                {moves?.length ? (
                  <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>Date</th><th>De</th><th>Vers</th><th>Motif</th></tr></thead><tbody>
                    {moves.map((m) => <tr key={m.id}><td className="whitespace-nowrap">{dateTime(m.created_at)}</td><td>{m.from_position ? `#${m.from_position}` : "—"}</td><td>{m.to_position ? `#${m.to_position}` : "Hors classement"}</td><td className="text-[#a5a9b0]">{m.reason}</td></tr>)}
                  </tbody></table></div>
                ) : <p className="panel text-[#a5a9b0]">Aucun mouvement.</p>}
              </div>
            </div>
          )}

          {tab === "rewards" && (
            <div>
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="panel-flat"><div className="label">Total gagné</div><div className="font-display text-4xl">{money(cashTotal)}</div></div>
                <div className="panel-flat"><div className="label">Versé</div><div className="font-display text-4xl text-ok">{money(cashPaid)}</div></div>
                <div className="panel-flat"><div className="label">En attente</div><div className="font-display text-4xl text-red">{money(cashTotal - cashPaid)}</div></div>
              </div>
              {rewards?.length ? (
                <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>Date</th><th>Boss battu</th><th>Montant</th><th>Statut</th><th>Versé le</th><th>Clip</th></tr></thead><tbody>
                  {rewards.map((r: Row) => (
                    <tr key={r.id}><td>{dateOnly(r.created_at)}</td><td>#{r.rank_beaten}</td><td className="font-cond text-lg font-bold">{money(r.amount)}</td>
                      <td><span className={`badge ${r.status === "paid" ? "badge-ok" : "badge-warn"}`}>{r.status === "paid" ? "Paid" : "Pending"}</span></td>
                      <td>{r.reward_payments ? dateOnly((Array.isArray(r.reward_payments) ? r.reward_payments[0] : r.reward_payments)?.paid_at) : "—"}</td>
                      <td>{r.clip_url ? <a href={r.clip_url} target="_blank" rel="noopener noreferrer" className="text-red hover:text-white">Voir</a> : "—"}</td></tr>
                  ))}
                </tbody></table></div>
              ) : <p className="panel text-[#a5a9b0]">Aucune récompense. Bats un pilote de la Blacklist pour remporter son Cash Prize.</p>}
              <p className="mt-4 text-xs text-metal">Le site ne réalise aucun transfert d&apos;argent : il suit uniquement les versements effectués par l&apos;organisation.</p>
            </div>
          )}

          {tab === "garage" && (
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div className="grid content-start gap-5">
                <div className="kicker">VÉHICULE ENGAGÉ</div>
                {current ? (
                  <div className="overflow-hidden border border-white/10 bg-ink2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl(current.photo_path)!} alt="" className="aspect-video w-full object-cover" />
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="font-cond text-2xl font-bold uppercase tracking-wide">{current.make_model}<div className="text-sm font-normal text-metal">{current.vehicle_class}</div></div><span className="badge badge-ok">Approved</span></div>
                  </div>
                ) : <p className="panel text-[#a5a9b0]">Aucun véhicule homologué. {vehicles?.some((v) => v.status === "lost") && <b className="text-[#ff6b6b]">Ton ancien véhicule a été confisqué : enregistre-en un nouveau et fais-le homologuer.</b>}</p>}
                {pending && (
                  <div className="panel">
                    <div className="mb-2 flex items-center justify-between"><div className="kicker">DEMANDE EN COURS</div><span className="badge badge-warn">Pending Approval</span></div>
                    <div className="font-cond text-xl uppercase tracking-wide">{pending.make_model}</div>
                    <ActionForm action={cancelProposal} label="CANCEL REQUEST" variant="ghost" small confirm="Annuler cette demande d'homologation ?" />
                  </div>
                )}
                {lastVeh && !pending && <p className="panel border-l-red text-sm"><b className="text-[#ff6b6b]">Dernière demande refusée :</b> {lastVeh.make_model} — {lastVeh.rejection_reason}</p>}
                <div>
                  <div className="kicker mb-3">HISTORIQUE DES VÉHICULES</div>
                  <ul className="grid gap-2">{vehicles?.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 bg-ink2 px-4 py-3"><span className="font-cond uppercase tracking-wide">{v.make_model} <span className="text-xs text-metal">· {dateOnly(v.created_at)}</span></span><span className={`badge ${VSTATUS[v.status][1]}`}>{VSTATUS[v.status][0]}</span></li>
                  ))}</ul>
                </div>
              </div>
              <ActionForm action={proposeVehicle} label={pending ? "REQUEST PENDING" : current ? "PROPOSE A CHANGE" : "SUBMIT VEHICLE"} className="panel content-start" confirm="Ce véhicule sera soumis à homologation. Ton véhicule actuel reste engagé jusqu'à la décision de l'organisation.">
                <div className="kicker mb-4">{current ? "CHANGER DE VÉHICULE" : "ENREGISTRER UN VÉHICULE"}</div>
                <fieldset disabled={!!pending} className="grid gap-4">
                  <Field label="Marque et modèle"><input name="make_model" required maxLength={80} className="input" /></Field>
                  <Field label="Catégorie"><select name="vehicle_class" required defaultValue="" className="input"><option value="" disabled>Choisir…</option>{classes.map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <fieldset><legend className="label">Véhicule de boutique ?</legend><div className="flex gap-6 text-[15px]"><label className="flex items-center gap-2"><input type="radio" name="shop" value="no" required className="accent-[#c62828]" /> Non</label><label className="flex items-center gap-2"><input type="radio" name="shop" value="yes" className="accent-[#c62828]" /> Oui</label></div></fieldset>
                  <Field label="Photographie" hint="JPEG, PNG ou WebP — 5 Mo max."><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="input file:mr-3 file:border-0 file:bg-red file:px-3 file:py-1 file:font-cond file:text-xs file:font-bold file:uppercase file:text-white" /></Field>
                </fieldset>
              </ActionForm>
            </div>
          )}
          <div className="mt-12 text-xs text-metal">Compte créé le {dateOnly(profile.created_at)} · <Link href="/notifications" className="text-red hover:text-white">Voir mes notifications</Link></div>
        </div>
      </section>
    </>
  );
}
