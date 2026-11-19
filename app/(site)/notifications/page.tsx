import type { Metadata } from "next";
import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import PageHead from "@/components/PageHead";
import PushPanel from "@/components/PushPanel";
import { markAllRead } from "@/app/actions/driver";
import { requireDriver } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { localizeNotif } from "@/lib/notif-i18n";

export const metadata: Metadata = { title: "Notifications" };

export default async function Notifications() {
  const [{ t, lang, locale }, { supabase, user }] = await Promise.all([getI18n(), requireDriver()]);
  await supabase.rpc("duel_reminders");
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return (
    <>
      <PageHead kicker={t("BOÎTE DE RÉCEPTION")} title={t("Mes")} em={t("notifications")} />
      <section className="py-14">
        <div className="wrap [&>*]:max-w-3xl">
          <PushPanel className="mb-6" />
          {unread > 0 && <ActionForm action={markAllRead} label={t("MARQUER {n} COMME LU(ES)", { n: unread })} variant="ghost" small className="mb-6" />}
          {!data?.length && <p className="panel text-[#a5a9b0]">{t("Aucune notification.")}</p>}
          <ul className="grid gap-2.5">
            {data?.map((n) => {
              const lost = n.kind === "vehicle_lost";
              const x = localizeNotif(n, lang);
              const body = (
                <div className={`border-l-4 p-5 ${lost ? "border-red bg-[#2a1214]" : n.read_at ? "border-white/10 bg-ink2" : "border-red bg-ink3"}`}>
                  <div className="font-cond flex items-center justify-between text-xs tracking-[.2em] text-metal">
                    <span>{lost ? <b className="text-red">{t("VÉHICULE CONFISQUÉ")}</b> : x.kind}</span><span>{dateTime(n.created_at, locale)}</span>
                  </div>
                  <div className={`font-cond mt-1 text-xl font-bold tracking-wide ${n.read_at ? "text-[#cfcfcf]" : "text-white"}`}>{x.title}</div>
                  {x.body && <p className="mt-1 text-sm text-[#a5a9b0]">{x.body}</p>}
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link}>{body}</Link> : body}</li>;
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
