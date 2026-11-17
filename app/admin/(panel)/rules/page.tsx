import ActionForm from "@/components/ActionForm";
import { AdminHead } from "@/components/AdminUI";
import { saveSetting } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RulesAdmin() {
  const { supabase, isSuperAdmin } = await requireAdmin();
  const { data: settings } = await supabase.from("settings").select("*").order("key");
  return (
    <>
      <AdminHead kicker="CONFIGURATION" title="Rules">Délais, récompenses et règles de duel : modifiables sans toucher au code. Chaque changement est validé, journalisé et s&apos;applique immédiatement.</AdminHead>
      {!isSuperAdmin && <p className="badge badge-warn mb-6 !normal-case">Lecture seule : seul un super administrateur peut modifier les règles.</p>}
      <div className="grid gap-4">{settings?.map((s) => (
        <article key={s.key} className="border border-white/10 bg-ink2 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-cond text-lg font-bold tracking-[.12em]">{s.key}</h2><span className="text-xs text-metal">modifié {dateTime(s.updated_at)}</span></div>
          <p className="mb-3 text-sm text-[#a5a9b0]">{s.description}</p>
          {isSuperAdmin ? (
            <ActionForm action={saveSetting} label="SAVE RULE" small variant="dark" reset={false} confirm={`Modifier la règle « ${s.key} » ? Elle s'applique immédiatement à tout le site.`}>
              <input type="hidden" name="key" value={s.key} />
              <textarea name="value" defaultValue={JSON.stringify(s.value, null, typeof s.value === "object" ? 1 : 0)} rows={typeof s.value === "object" ? 6 : 1} className="input font-mono text-sm" spellCheck={false} />
            </ActionForm>
          ) : <pre className="overflow-x-auto bg-ink p-3 text-sm">{JSON.stringify(s.value)}</pre>}
        </article>
      ))}</div>
    </>
  );
}
