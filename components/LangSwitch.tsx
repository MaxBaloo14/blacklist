import { setLang } from "@/app/actions/lang";
import { getLang } from "@/lib/i18n";

const FR = (
  <svg viewBox="0 0 3 2" width="24" height="16" aria-hidden><rect width="1" height="2" fill="#0055A4" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#EF4135" /></svg>
);
const EN = (
  <svg viewBox="0 0 60 30" width="26" height="14" aria-hidden>
    <clipPath id="uk"><path d="M0 0h60v30H0z" /></clipPath>
    <g clipPath="url(#uk)"><path d="M0 0v30h60V0z" fill="#012169" /><path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" /><path d="M0 0l60 30m0-30L0 30" stroke="#C8102E" strokeWidth="2" /><path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" /><path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" /></g>
  </svg>
);

/** Bascule FR / EN (drapeaux en SVG). La langue est mémorisée dans un cookie. */
export default async function LangSwitch() {
  const lang = await getLang();
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Langue / Language">
      {([["fr", FR, "Français"], ["en", EN, "English"]] as const).map(([code, flag, label]) => (
        <form key={code} action={setLang}>
          <input type="hidden" name="lang" value={code} />
          <button type="submit" title={label} aria-label={label} aria-pressed={lang === code}
            className={`flex h-7 items-center border px-1.5 transition ${lang === code ? "border-red opacity-100" : "border-white/15 opacity-50 hover:opacity-100"}`}>
            {flag}
          </button>
        </form>
      ))}
    </div>
  );
}
