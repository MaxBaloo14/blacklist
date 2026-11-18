import TemplatePicker from "@/components/TemplatePicker";
import ActionForm from "@/components/ActionForm";
import { AdminHead, Details } from "@/components/AdminUI";
import Field from "@/components/Field";
import { markVehicleLost, reviewVehicle } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateTime, fullName, photoUrl } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function VehiclesAdmin() {
  const { t, locale } = await getI18n();
  const L = labels(t);
  const { supabase } = await requireAdmin();
  const [{ data: pending }, { data: approved }, { data: recent }, { data: tpls }] = await Promise.all([
    supabase.from("vehicles").select("*, profiles(first_name,last_name,phone)").eq("status", "pending").order("created_at"),
    supabase.from("vehicles").select("*, profiles(first_name,last_name)").eq("status", "approved").order("created_at", { ascending: false }),
    supabase.from("vehicle_approvals").select("*, vehicles(make_model, profiles(first_name,last_name))").order("created_at", { ascending: false }).limit(25),
    supabase.from("message_templates").select("id,title,body").eq("kind", "vehicle").order("title"),
  ]);
  return (
    <>
      <AdminHead kicker={t("HOMOLOGATION")} title={t("Véhicules")}>{t("Examine la photographie, vérifie la catégorie (boutique et Supersportives interdites), puis homologue ou refuse avec un motif.")}</AdminHead>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">En attente d&apos;homologation ({pending?.length ?? 0})</h2>
      {!pending?.length && <p className="panel mb-10 text-[#a5a9b0]">{t("Aucune demande en attente.")}</p>}
      <div className="mb-12 grid gap-5 lg:grid-cols-2">
        {pending?.map((v) => (
          <article key={v.id} className="overflow-hidden border border-white/10 bg-ink2">
            {v.photo_path ? <a href={photoUrl(v.photo_path)!} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photoUrl(v.photo_path)!} alt="" className="aspect-video w-full object-cover" /></a> : <div className="grid aspect-video w-full place-items-center bg-ink3 font-cond text-xs tracking-[.3em] text-metal">{t("PAS DE PHOTO")}</div>}
            <div className="p-5">
              <div className="font-cond text-2xl font-bold uppercase tracking-wide">{v.make_model}</div>
              <div className="text-sm text-[#a5a9b0]">{v.vehicle_class} · {fullName(v.profiles)} · {v.profiles?.phone} · {dateTime(v.created_at, locale)}{v.replaces_vehicle_id && <span className="badge badge-warn ml-2">{t("Changement de véhicule")}</span>}</div>
              <div className="mt-4 grid gap-3">
                <ActionForm action={reviewVehicle} label="HOMOLOGUER" small confirm="Homologuer ce véhicule ? Le pilote sera notifié.">
                  <input type="hidden" name="vehicle" value={v.id} /><input type="hidden" name="decision" value="approved" />
                </ActionForm>
                <Details summary={t("Refuser avec motif")} tone="text-red">
                  <ActionForm action={reviewVehicle} label="REFUSER" variant="ghost" small confirm="Refuser ce véhicule ? Le motif sera communiqué au pilote.">
                    <input type="hidden" name="vehicle" value={v.id} /><input type="hidden" name="decision" value="rejected" />
                    <TemplatePicker templates={tpls ?? []} target="reason" />
                    <Field label={t("Motif du refus (visible du pilote)")}><input name="reason" required minLength={3} className="input" /></Field>
                  </ActionForm>
                </Details>
              </div>
            </div>
          </article>
        ))}
      </div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">{t("Véhicules engagés")} ({approved?.length ?? 0})</h2>
      <div className="mb-12 overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th></th><th>{t("Véhicule")}</th><th>{t("Pilote")}</th><th>{t("Actions")}</th></tr></thead><tbody>
        {approved?.map((v) => (
          <tr key={v.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<td>{v.photo_path ? <img src={photoUrl(v.photo_path)!} alt="" className="h-10 w-16 object-cover" /> : <div className="h-10 w-16 bg-ink3" />}</td><td className="font-cond font-bold uppercase tracking-wide">{v.make_model}<div className="text-xs font-normal normal-case text-metal">{v.vehicle_class}</div></td><td>{fullName(v.profiles)}</td>
            <td><div className="grid max-w-xs gap-2">
              <Details summary={t("Disqualifier")} tone="text-red"><ActionForm action={reviewVehicle} label="DISQUALIFIER" variant="ghost" small confirm="Disqualifier ce véhicule ? Le pilote ne pourra plus participer tant qu'un nouveau véhicule n'est pas homologué."><input type="hidden" name="vehicle" value={v.id} /><input type="hidden" name="decision" value="disqualified" /><Field label={t("Motif")}><input name="reason" required minLength={3} className="input" /></Field></ActionForm></Details>
              <Details summary={t("Perte / confiscation")} tone="text-red"><ActionForm action={markVehicleLost} label="MARQUER COMME PERDU" variant="ghost" small confirm="Le véhicule passera au statut Lost, définitivement."><input type="hidden" name="driver" value={v.owner_id} /><Field label={t("Motif")}><input name="reason" required minLength={3} className="input" /></Field></ActionForm></Details>
            </div></td></tr>
        ))}
      </tbody></table>{!approved?.length && <p className="p-5 text-[#a5a9b0]">{t("Aucun véhicule engagé.")}</p>}</div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">{t("Dernières décisions")}</h2>
      <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>{t("Date")}</th><th>{t("Véhicule")}</th><th>{t("Pilote")}</th><th>{t("Décision")}</th><th>{t("Motif")}</th></tr></thead><tbody>
        {recent?.map((r) => <tr key={r.id}><td className="whitespace-nowrap">{dateTime(r.created_at, locale)}</td><td>{r.vehicles?.make_model}</td><td>{fullName(r.vehicles?.profiles)}</td><td><span className={`badge ${r.decision === "approved" ? "badge-ok" : "badge-red"}`}>{L.decision(r.decision)}</span></td><td className="text-[#a5a9b0]">{r.reason}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
