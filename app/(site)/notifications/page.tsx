import type { Metadata } from "next";
import ActionForm from "@/components/ActionForm";
import PageHead from "@/components/PageHead";
import { markAllRead } from "@/app/actions/driver";
import { requireDriver } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import Link from "next/link";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function Notifications() {
  const { supabase, user } = await requireDriver();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return (
    <>
      <PageHead kicker="INBOX" title="Notifi" em="cations" />
      <section className="py-14">
        <div className="wrap max-w-3xl">
          {unread > 0 && <ActionForm action={markAllRead} label={`MARK ${unread} AS READ`} variant="ghost" small className="mb-6" />}
          {!data?.length && <p className="panel text-[#a5a9b0]">Aucune notification.</p>}
          <ul className="grid gap-2.5">
            {data?.map((n) => {
              const lost = n.kind === "vehicle_lost";
              const body = (
                <div className={`border-l-4 p-5 ${lost ? "border-red bg-[#2a1214]" : n.read_at ? "border-white/10 bg-ink2" : "border-red bg-ink3"}`}>
                  <div className="font-cond flex items-center justify-between text-xs tracking-[.2em] text-metal">
                    <span>{lost ? <b className="text-red">VEHICLE CONFISCATED</b> : n.kind.replace(/_/g, " ").toUpperCase()}</span><span>{dateTime(n.created_at)}</span>
                  </div>
                  <div className={`font-cond mt-1 text-xl font-bold tracking-wide ${n.read_at ? "text-[#cfcfcf]" : "text-white"}`}>{n.title}</div>
                  {n.body && <p className="mt-1 text-sm text-[#a5a9b0]">{n.body}</p>}
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
