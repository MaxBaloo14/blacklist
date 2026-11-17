import { EN } from "@/lib/i18n-en";

export type Lang = "fr" | "en";
export type TFn = (fr: string, vars?: Record<string, string | number>) => string;

/** Le français est la langue source : t("texte français") renvoie la traduction anglaise si la langue est "en". */
export function makeT(lang: Lang): TFn {
  return (fr, vars) => {
    let s = lang === "en" ? (EN[fr] ?? fr) : fr;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
    return s;
  };
}
