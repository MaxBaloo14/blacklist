import type { Lang } from "@/lib/i18n-core";
import { EN } from "@/lib/i18n-en";

// Les notifications sont enregistrées en anglais par la base (texte fixe, valable pour tous).
// En français, on traduit à l'affichage les messages connus ; les motifs écrits par l'organisation restent tels quels.
const TITLES: [RegExp, string][] = [
  [/^Zigollars added to your balance$/, "Des zigollars ont été ajoutés à ton solde"],
  [/^Zigollars removed from your balance$/, "Des zigollars ont été retirés de ton solde"],
  [/^New shop order$/, "Nouvelle commande boutique"],
  [/^Your order has been cancelled and refunded$/, "Ta commande a été annulée et remboursée"],
  [/^Your order has been delivered$/, "Ta commande a été remise"],
  [/^You won your bet$/, "Tu as gagné ton pari"],
  [/^You lost your bet$/, "Tu as perdu ton pari"],
  [/^Your bet has been refunded$/, "Ton pari a été remboursé"],
  [/^The random track has been drawn$/, "La carte aléatoire a été tirée"],
  [/^A track has been chosen for your duel$/, "Une carte a été choisie pour ton duel"],
  [/^Add your IBAN to receive your Cash Prize$/, "Ajoute ton IBAN pour recevoir ton Cash Prize"],
  [/^Your duel starts in 24 hours$/, "Ton duel commence dans 24 h"],
  [/^Your duel starts in 1 hour$/, "Ton duel commence dans 1 h"],
  [/^A new challenge has been issued$/, "Un nouveau défi t'a été lancé"],
  [/^You have (\d+) hours to schedule your duel$/, "Tu as $1 h pour fixer la date de ton duel"],
  [/^Challenge sent$/, "Défi envoyé"],
  [/^Your duel has been scheduled$/, "Ton duel est programmé"],
  [/^Your duel has been cancelled$/, "Ton duel a été annulé"],
  [/^Your registration has been validated$/, "Ton inscription a été validée"],
  [/^Your registration has been rejected$/, "Ton inscription a été refusée"],
  [/^Your account status is now: (\w+)$/, "Le statut de ton compte est maintenant : $1"],
  [/^Your vehicle has been approved$/, "Ton véhicule a été homologué"],
  [/^Your vehicle has been rejected$/, "Ton véhicule a été refusé"],
  [/^Your vehicle has been disqualified$/, "Ton véhicule a été disqualifié"],
  [/^Your vehicle has been confiscated$/, "Ton véhicule a été confisqué"],
  [/^You have received a Cash Prize$/, "Tu as reçu un Cash Prize"],
  [/^Your Cash Prize has been paid$/, "Ton Cash Prize a été versé"],
  [/^Congratulations, you won the duel$/, "Félicitations, tu as remporté le duel"],
  [/^You lost the duel$/, "Tu as perdu le duel"],
  [/^Your race has been validated$/, "Ta course a été validée"],
  [/^Your position in the Blacklist has changed$/, "Ta position dans la Blacklist a changé"],
  [/^A sanction has been applied$/, "Une sanction a été appliquée"],
  [/^Your absence has been recorded$/, "Ton absence a été enregistrée"],
  [/^You won the Warm-up Race$/, "Tu as remporté la Warm-up Race"],
  [/^Your inactivity period requires attention$/, "Ta période d'inactivité demande ton attention"],
];
const BODIES: [RegExp, string][] = [
  [/^Your Cash Prize of \$(\d+) cannot be paid until you add your bank IBAN in your profile\.$/, "Ton Cash Prize de $1 $ ne peut pas être versé tant que tu n'as pas renseigné ton IBAN bancaire dans ton profil."],
  [/^Set a duel date within the current week before the deadline\.$/, "Fixe une date de duel dans la semaine en cours avant la fin du délai."],
  [/^You lost your engaged vehicle\. Register a new valid vehicle and get it approved to race again\.$/, "Tu as perdu ton véhicule engagé. Enregistre un nouveau véhicule valide et fais-le homologuer pour pouvoir courir à nouveau."],
  [/^You are now #(\d+)\.$/, "Tu es maintenant #$1."],
  [/^You have left the Blacklist\.$/, "Tu as quitté la Blacklist."],
  [/^You are now eligible to enter the Blacklist at #10\.$/, "Tu es maintenant éligible à l'entrée dans la Blacklist au #10."],
  [/^Prize for beating #(\d+) : \$(\d+)$/, "Prime pour avoir battu le #$1 : $2 $"],
  [/^(\d+) days without an official duel\.$/, "$1 jours sans duel officiel."],
  [/^(.+) \(#(\d+)\) challenges you\.$/, "$1 (#$2) te défie."],
  [/^Your challenge against (.+) is live\.$/, "Ton défi contre $1 est lancé."],
  [/^\$(\d+)$/, "$1 $"],
  [/^([+-]\d+) zigollars$/, "$1 zigollars"],
  [/^(.+) \(set by the organisation\)$/, "$1 (fixé par l'organisation)"],
];
const KINDS: Record<string, string> = {
  challenge_new: "DÉFI", challenge_deadline: "DÉLAI", challenge_sent: "DÉFI", challenge_scheduled: "DUEL PROGRAMMÉ", challenge_cancelled: "DUEL ANNULÉ",
  registration: "INSCRIPTION", account: "COMPTE", vehicle_approved: "VÉHICULE", vehicle_rejected: "VÉHICULE", vehicle_disqualified: "VÉHICULE", vehicle_lost: "VÉHICULE CONFISQUÉ",
  reward: "CASH PRIZE", reward_paid: "CASH PRIZE", duel_won: "VICTOIRE", duel_lost: "DÉFAITE", duel_validated: "COURSE VALIDÉE", ranking_changed: "CLASSEMENT",
  points: "POINTS", shop: "BOUTIQUE", shop_order: "BOUTIQUE", bet: "PARI", track_chosen: "CARTE", sanction: "SANCTION", duel_reminder: "RAPPEL DE DUEL", iban_missing: "IBAN MANQUANT", absence: "ABSENCE", warmup_won: "WARM-UP RACE", inactivity: "INACTIVITÉ",
};

const apply = (s: string, rules: [RegExp, string][]) => {
  for (const [re, fr] of rules) if (re.test(s)) return s.replace(re, fr);
  return s;
};

// Montants lisibles : 800000 → 800 000 $ (français) ou $800,000 (anglais)
const money = (body: string | null, lang: Lang) => body && (lang === "en"
  ? body.replace(/\$(\d{4,})/g, (_, d) => "$" + Number(d).toLocaleString("en-US"))
  : body.replace(/(\d{4,}) \$/g, (_, d) => Number(d).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ") + " $"));

export function localizeNotif(n: { kind: string; title: string; body: string | null }, lang: Lang) {
  if (lang === "en") {
    // les noms d'articles de la boutique sont enregistrés en français : on traduit ceux qu'on connaît
    const body = n.body && /^shop/.test(n.kind) ? n.body.split(" — ").map((p) => EN[p] ?? p).join(" — ") : n.body;
    return { kind: n.kind.replace(/_/g, " ").toUpperCase(), title: n.title, body: money(body, lang) };
  }
  return { kind: KINDS[n.kind] ?? n.kind.replace(/_/g, " ").toUpperCase(), title: apply(n.title, TITLES), body: money(n.body ? apply(n.body, BODIES) : n.body, lang) };
}

/** Motifs d'historique du classement créés par la base. */
export function localizeReason(r: string | null, lang: Lang) {
  if (!r || lang === "en") return r;
  return r
    .replace(/^Duel #(\w+)$/, "Duel #$1").replace(/^Warm-up Race winner$/, "Vainqueur de la Warm-up Race").replace(/^Promoted from reserve$/, "Promu depuis la réserve")
    .replace(/^Replaces (.+)$/, "Remplace $1").replace(/^Promoted to #(\d+)$/, "Promu au #$1").replace(/^Lost the podium duel against (.+)$/, "Duel du podium perdu contre $1");
}
