"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useLang, useT } from "@/components/LangProvider";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const b64 = (s: string) => { const pad = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

/** Active ou coupe les notifications push sur cet appareil (téléphone ou ordinateur). */
export default function PushPanel({ className = "" }: { className?: string }) {
  const t = useT();
  const lang = useLang();
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = (navigator as unknown as { standalone?: boolean }).standalone || window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await (await navigator.serviceWorker.ready ?? reg).pushManager.getSubscription();
        setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch { setState("unsupported"); }
    })();
  }, []);

  const enable = async () => {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push/key")).json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }));
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), lang }) });
      if (!r.ok) throw new Error("subscribe");
      setState("on"); setMsg(t("Notifications activées sur cet appareil."));
    } catch { setMsg(t("Activation impossible. Réessaie ou vérifie les réglages de ton navigateur.")); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true); setMsg("");
    try {
      const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
      if (sub) { await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
      setState("off"); setMsg(t("Notifications désactivées sur cet appareil."));
    } catch { setMsg(t("Désactivation impossible.")); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMsg("");
    try { const r = await fetch("/api/push/test", { method: "POST" }); const j = await r.json(); setMsg(j.ok ? t("Notification de test envoyée : regarde ton appareil.") : t("Aucun appareil n'a répondu. Réactive les notifications.")); }
    catch { setMsg(t("Envoi impossible.")); } finally { setBusy(false); }
  };

  if (state === "loading") return null;
  return (
    <div className={`panel ${className}`} data-push-state={state}>
      <div className="mb-2 flex items-center gap-2"><BellRing size={18} className="text-red" aria-hidden /><div className="kicker !tracking-[.25em]">{t("NOTIFICATIONS SUR TON APPAREIL")}</div></div>
      {state === "unsupported" && <p className="text-sm text-[#a5a9b0]">{t("Ce navigateur ne gère pas les notifications. Essaie avec Chrome, Edge, Firefox ou Safari récent.")}</p>}
      {state === "ios-install" && <p className="text-sm text-[#a5a9b0]">{t("Sur iPhone, ajoute d'abord le site à l'écran d'accueil (bouton Partager, puis « Sur l'écran d'accueil »), ouvre-le depuis l'icône, puis reviens ici.")}</p>}
      {state === "denied" && <p className="text-sm text-[#a5a9b0]">{t("Les notifications sont bloquées pour ce site. Autorise-les dans les réglages de ton navigateur, puis recharge la page.")}</p>}
      {(state === "off" || state === "on") && (
        <>
          <p className="text-sm text-[#a5a9b0]">{state === "on" ? t("Tu recevras tes alertes (défi, date de duel, rappel, résultat, prime) même quand le site est fermé.") : t("Reçois tes alertes (défi, date de duel, rappel, résultat, prime) directement sur cet appareil, même quand le site est fermé.")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {state === "off" ? <button type="button" onClick={enable} disabled={busy} className="btn btn-red btn-sm">{t("ACTIVER LES NOTIFICATIONS")}</button>
              : <><button type="button" onClick={test} disabled={busy} className="btn btn-dark btn-sm">{t("ENVOYER UN TEST")}</button><button type="button" onClick={disable} disabled={busy} className="btn btn-ghost btn-sm">{t("DÉSACTIVER")}</button></>}
          </div>
        </>
      )}
      {msg && <p role="status" className="mt-3 text-sm text-ok">{msg}</p>}
    </div>
  );
}
