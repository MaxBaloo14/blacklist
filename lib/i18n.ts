import { cookies } from "next/headers";
import { makeT, type Lang } from "@/lib/i18n-core";

export async function getLang(): Promise<Lang> {
  return (await cookies()).get("lang")?.value === "en" ? "en" : "fr";
}
export async function getT() {
  return makeT(await getLang());
}

export async function getI18n() {
  const lang = await getLang();
  return { lang, t: makeT(lang), locale: lang === "en" ? "en-GB" : "fr-FR" };
}
