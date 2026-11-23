import TemplatePicker from "@/components/TemplatePicker";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import { AdminHead, Details } from "@/components/AdminUI";
import Field from "@/components/Field";
import { addReserve, deleteAccount, markVehicleLost, recordAbsence, resetDriverPassword, setAccountStatus, updateDriverInfo, validateRegistration } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateOnly, dateTime, fullName, photoUrl } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f-]{36}$/i;

export default async function DriverAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = await getI18n();
  const L = labels(t);
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const { supabase, isSuperAdmin } = await requireAdmin();
  const { data: d } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!d) notFound();
  const [{ data: vehicles }, { data: rank }, { data: chal }, { data: absences }, { data: sanctions }, { data: inact }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("owner_id", id).order("created_at", { ascending: false }),
    supabase.from("blacklist_rankings").select("position").eq("driver_id", id).maybeSingle(),
    supabase.from("public_duels").select("*").or(`challenger_id.eq.${id},defender_id.eq.${id}`).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(20),
    supabase.from("absences").select("*").eq("driver_id", id).order("starts_on", { ascending: false }),
    supabase.from("sanctions").select("*").eq("driver_id", id).order("created_at", { ascending: false }),
    supabase.rpc("inactivity_days", { p_driver: id }),
  ]);
  const { data: delInfo } = isSuperAdmin ? await supabase.rpc("driver_deletion_info", { p_driver: id }) : { data: null };
  const { data: regTpls } = await supabase.from("message_templates").select("id,title,body").eq("kind", "registration").order("title");
  const approved = vehicles?.find((v) => v.status === "approved");
  return (
    <>
      <AdminHead kicker={rank ? `BLACKLIST #${rank.position}` : t("FICHE PILOTE")} title={fullName(d)}>{t("Tél.")} : {d.phone}{d.discord_tag ? ` · Discord : ${d.discord_tag}` : ""} · IBAN : {d.bank_iban ?? "—"} · {t("Dernière activité")} : {dateTime(d.last_activity_at, locale)}{rank ? ` · ${t("{n} j sans duel", { n: inact ?? 0 })}` : ""}</AdminHead>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel">
          <div className="kicker mb-3">{t("INSCRIPTION —")} <span className={d.registration_status === "validated" ? "text-ok" : ""}>{L.reg(d.registration_status).toUpperCase()}</span></div>
          <ActionForm action={validateRegistration} label="ENREGISTRER LA DÉCISION" reset={false} confirm="Enregistrer cette décision ? Le pilote sera notifié.">
            <input type="hidden" name="driver" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Décision")}><select name="decision" className="input"><option value="validated">{t("Valider")}</option><option value="rejected">{t("Refuser")}</option></select></Field>
              <div className="sm:col-span-2"><TemplatePicker templates={regTpls ?? []} target="note" /></div>
              <Field label={t("Note / motif (visible du pilote)")}><input name="note" className="input" defaultValue={d.registration_note ?? ""} /></Field>
            </div>
          </ActionForm>
        </div>
        <div className="panel">
          <div className="kicker mb-3">{t("COMPTE —")} <span className={d.account_status === "active" ? "text-ok" : "text-red"}>{L.account(d.account_status).toUpperCase()}</span></div>
          <ActionForm action={setAccountStatus} label="APPLIQUER" variant="dark" reset={false} confirm="Modifier le statut de ce compte ? Le pilote en sera informé.">
            <input type="hidden" name="driver" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Nouveau statut")}><select name="status" defaultValue={d.account_status} className="input"><option value="active">{t("Actif")}</option><option value="suspended">{t("Suspendu")}</option><option value="banned">{t("Banni")}</option></select></Field>
              <Field label={t("Motif (obligatoire)")}><input name="reason" required minLength={3} className="input" /></Field>
            </div>
          </ActionForm>
          {isSuperAdmin && delInfo && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <Details summary={t("Supprimer ce compte")} tone="text-red">
                <p className="mb-3 text-sm text-[#a5a9b0]">{t("Suppression définitive du compte et de toutes ses données (véhicules, zigollars, commandes, notifications). Cette action est irréversible. Pour garder l'historique tout en bloquant le pilote, utilise plutôt le statut « Banni ».")}</p>
                <p className="mb-3 font-cond text-sm tracking-wide text-[#cfcfcf]" data-deletion-info>{t("Historique")} : {delInfo.duels} {t("duel(s)")} · {delInfo.rewards} Cash Prize · {delInfo.sanctions} {t("sanction(s)")}{delInfo.ranked ? ` · ${t("classé dans la Blacklist")}` : ""}</p>
                {delInfo.is_admin ? <p className="text-sm text-[#ffd48a]">{t("Ce compte est un organisateur : retire d'abord ses droits.")}</p>
                  : delInfo.active > 0 ? <p className="text-sm text-[#ffd48a]">{t("Un duel est en cours pour ce pilote : annule-le d'abord.")}</p> : (
                  <ActionForm action={deleteAccount} label="SUPPRIMER DÉFINITIVEMENT" variant="ghost" small reset={false} confirm={t("Supprimer définitivement le compte de {n} ? Cette action est irréversible.", { n: fullName(d) })}>
                    <input type="hidden" name="driver" value={d.id} />
                    {(delInfo.duels + delInfo.rewards + delInfo.sanctions) > 0 && (
                      <label className="mb-3 flex items-start gap-2 text-sm"><input type="checkbox" name="force" className="mt-1 accent-[#d12b2b]" /> <span>{t("Supprimer aussi son historique (ses duels, Cash Prize et sanctions disparaissent des statistiques et du Hall of Fame)")}</span></label>
                    )}
                    <Field label={t("Tape SUPPRIMER pour confirmer")}><input name="confirm" required autoComplete="off" className="input" placeholder="SUPPRIMER" /></Field>
                  </ActionForm>
                )}
              </Details>
            </div>
          )}
        </div>
        <ActionForm action={updateDriverInfo} label="METTRE À JOUR" reset={false} className="panel">
          <div className="kicker mb-3">{t("INFORMATIONS")}</div>
          <input type="hidden" name="driver" value={d.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Prénom")}><input name="first_name" defaultValue={d.first_name} required className="input" /></Field>
            <Field label={t("Nom")}><input name="last_name" defaultValue={d.last_name} required className="input" /></Field>
            <Field label={t("Téléphone")}><input name="phone" defaultValue={d.phone} required className="input" /></Field>
          </div>
        </ActionForm>
        <div className="panel">
          <div className="kicker mb-3">{t("CONNEXION DU PILOTE")}</div>
          <p className="mb-3 text-sm text-[#a5a9b0]">{t("Identifiant de connexion :")} <b className="text-bone">{d.phone}</b> {t("(numéro de téléphone). Le pilote n'a pas d'email de récupération : en cas d'oubli, définis-lui un nouveau mot de passe ici.")}</p>
          <ActionForm action={resetDriverPassword} label="RÉINITIALISER LE MOT DE PASSE" variant="dark" small confirm="Définir un nouveau mot de passe pour ce pilote ? L'ancien ne fonctionnera plus.">
            <input type="hidden" name="driver" value={d.id} />
            <Field label={t("Nouveau mot de passe (10 caractères minimum)")}><input name="password" type="text" required minLength={10} maxLength={72} autoComplete="off" className="input" /></Field>
          </ActionForm>
        </div>
        <div className="panel">
          <div className="kicker mb-3">{t("VÉHICULES")}</div>
          <ul className="grid gap-2">{vehicles?.map((v) => (
            <li key={v.id} className="flex items-center gap-3 bg-ink p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.photo_path ? <img src={photoUrl(v.photo_path)!} alt="" className="h-12 w-20 object-cover" /> : <div className="h-12 w-20 bg-ink3" />}
              <div className="min-w-0 flex-1"><div className="font-cond truncate font-bold uppercase tracking-wide">{v.make_model}</div><div className="text-xs text-metal">{v.vehicle_class} · {dateOnly(v.created_at, locale)}{v.rejection_reason ? ` · ${v.rejection_reason}` : ""}</div></div>
              <span className="badge badge-metal">{L.vehicle(v.status)}</span>
            </li>
          ))}</ul>
          {approved && (
            <div className="mt-4"><Details summary={t("Enregistrer une confiscation (perte du véhicule)")} tone="text-red">
              <ActionForm action={markVehicleLost} label="CONFISQUER LE VÉHICULE" confirm="Le véhicule passera au statut Lost, définitivement. Le pilote devra en homologuer un nouveau." reset={false}>
                <input type="hidden" name="driver" value={d.id} /><Field label={t("Motif")}><input name="reason" required minLength={3} className="input" /></Field>
              </ActionForm></Details></div>
          )}
        </div>
        <div className="panel">
          <div className="kicker mb-3">{t("ABSENCES JUSTIFIÉES")}</div>
          <ul className="mb-4 grid gap-1.5 text-sm">{absences?.map((a) => <li key={a.id} className="bg-ink px-3 py-2">{dateOnly(a.starts_on, locale)} → {a.ends_on ? dateOnly(a.ends_on, locale) : t("en cours")} — {a.reason} {a.suspends_inactivity && <span className="badge badge-ok ml-1">{t("décompte suspendu")}</span>}</li>)}{!absences?.length && <li className="text-metal">{t("Aucune.")}</li>}</ul>
          <ActionForm action={recordAbsence} label="ENREGISTRER L'ABSENCE" variant="dark" small>
            <input type="hidden" name="driver" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Du")}><input type="date" name="from" required className="input" /></Field>
              <Field label={t("Au (vide = en cours)")}><input type="date" name="to" className="input" /></Field>
              <Field label={t("Motif")} className="sm:col-span-2"><input name="reason" required minLength={3} className="input" /></Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="suspends" defaultChecked className="accent-[#c62828]" /> {t("Suspend le décompte d'inactivité")}</label>
            </div>
          </ActionForm>
        </div>
        <div className="panel">
          <div className="kicker mb-3">{t("DÉFIS RÉCENTS")}</div>
          <ul className="grid gap-1.5 text-sm">{chal?.map((c) => <li key={c.id} className="flex justify-between gap-3 bg-ink px-3 py-2"><span>#{c.challenger_position} {c.challenger_first} {c.challenger_last} → #{c.defender_position} {c.defender_first} {c.defender_last}</span><span className={`badge ${L.challenge(c.status)[1]}`}>{L.challenge(c.status)[0]}</span></li>)}{!chal?.length && <li className="text-metal">{t("Aucun.")}</li>}</ul>
          <div className="kicker mb-2 mt-5">{t("SANCTIONS")}</div>
          <ul className="grid gap-1.5 text-sm">{sanctions?.map((s) => <li key={s.id} className="bg-ink px-3 py-2"><b>{L.sanction(s.type)}</b> — {s.reason} <span className="text-metal">({dateOnly(s.created_at, locale)})</span></li>)}{!sanctions?.length && <li className="text-metal">{t("Aucune.")}</li>}</ul>
          {!rank && approved && d.registration_status === "validated" && (
            <ActionForm action={addReserve} label="AJOUTER À LA RÉSERVE" variant="ghost" small className="mt-4"><input type="hidden" name="driver" value={d.id} /></ActionForm>
          )}
        </div>
      </div>
    </>
  );
}
