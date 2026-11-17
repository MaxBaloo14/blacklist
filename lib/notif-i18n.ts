import type { Lang } from "@/lib/i18n-core";

// Les notifications sont enregistrées en anglais par la base (texte fixe, valable pour tous).
// En français, on traduit à l'affichage les messages connus ; les motifs écrits par l'organisation restent tels quels.
const TITLES: [RegExp, string][] = [
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
  [/^(.+) \(set by the organisation\)$/, "$1 (fixé par l'organisation)"],
];
const KINDS: Record<string, string> = {
  challenge_new: "DÉFI", challenge_deadline: "DÉLAI", challenge_sent: "DÉFI", challenge_scheduled: "DUEL PROGRAMMÉ", challenge_cancelled: "DUEL ANNULÉ",
  registration: "INSCRIPTION", account: "COMPTE", vehicle_approved: "VÉHICULE", vehicle_rejected: "VÉHICULE", vehicle_disqualified: "VÉHICULE", vehicle_lost: "VÉHICULE CONFISQUÉ",
  reward: "CASH PRIZE", reward_paid: "CASH PRIZE", duel_won: "VICTOIRE", duel_lost: "DÉFAITE", duel_validated: "COURSE VALIDÉE", ranking_changed: "CLASSEMENT",
  sanction: "SANCTION", absence: "ABSENCE", warmup_won: "WARM-UP RACE", inactivity: "INACTIVITÉ",
};

const apply = (s: string, rules: [RegExp, string][]) => {
  for (const [re, fr] of rules) if (re.test(s)) return s.replace(re, fr);
  return s;
};

export function localizeNotif(n: { kind: string; title: string; body: string | null }, lang: Lang) {
  if (lang === "en") return { kind: n.kind.replace(/_/g, " ").toUpperCase(), title: n.title, body: n.body };
  return { kind: KINDS[n.kind] ?? n.kind.replace(/_/g, " ").toUpperCase(), title: apply(n.title, TITLES), body: n.body ? apply(n.body, BODIES) : n.body };
}

/** Motifs d'historique du classement créés par la base. */
export function localizeReason(r: string | null, lang: Lang) {
  if (!r || lang === "en") return r;
  return r
    .replace(/^Duel #(\w+)$/, "Duel #$1").replace(/^Warm-up Race winner$/, "Vainqueur de la Warm-up Race").replace(/^Promoted from reserve$/, "Promu depuis la réserve")
    .replace(/^Replaces (.+)$/, "Remplace $1").replace(/^Promoted to #(\d+)$/, "Promu au #$1").replace(/^Lost the podium duel against (.+)$/, "Duel du podium perdu contre $1");
}
