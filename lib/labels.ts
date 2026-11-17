import type { TFn } from "@/lib/i18n-core";

/** Libellés traduits des valeurs techniques stockées en base (statuts, types…). Clé = valeur en base. */
export function labels(t: TFn) {
  const L = (m: Record<string, string>) => (v?: string | null) => (v ? m[v] ?? v : "—");
  return {
    reg: L({ pending: t("En attente"), validated: t("Validée"), rejected: t("Refusée") }),
    account: L({ active: t("Actif"), suspended: t("Suspendu"), banned: t("Banni") }),
    vehicle: L({ pending: t("En attente d'homologation"), approved: t("Homologué"), rejected: t("Refusé"), disqualified: t("Disqualifié"), lost: t("Perdu"), replaced: t("Remplacé") }),
    decision: L({ approved: t("Homologué"), rejected: t("Refusé"), disqualified: t("Disqualifié") }),
    track: L({ active: t("Actif"), inactive: t("Inactif") }),
    warmup: L({ scheduled: t("Programmée"), running: t("En cours"), completed: t("Terminée"), cancelled: t("Annulée") }),
    reserve: L({ waiting: t("En attente"), promoted: t("Promu"), removed: t("Retiré") }),
    reward: L({ pending: t("En attente"), paid: t("Versé") }),
    difficulty: L({ Easy: t("Facile"), Medium: t("Moyen"), Hard: t("Difficile"), Extreme: t("Extrême") }),
    kind: L({ duel: t("Duel"), sanction: t("Sanction"), manual: t("Manuel"), entry: t("Entrée"), removal: t("Retrait"), reserve: t("Réserve") }),
    sanction: L({ lose_two_positions: t("Perte de deux positions"), removal: t("Retrait de la Blacklist"), replace_with_reserve: t("Remplacement par un réserviste") }),
    challenge: (v: string): [string, string] =>
      ({
        awaiting_schedule: [t("Date à fixer"), "badge-warn"], scheduled: [t("Programmé"), "badge-ok"], awaiting_validation: [t("À valider"), "badge-red"],
        completed: [t("Terminé"), "badge-metal"], cancelled: [t("Annulé"), "badge-metal"], forfeited: [t("Forfait"), "badge-red"],
      } as Record<string, [string, string]>)[v] ?? [v, "badge-metal"],
  };
}
