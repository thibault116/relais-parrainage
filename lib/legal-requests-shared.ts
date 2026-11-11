export const legalRequestLabels = {
  withdrawal: "Rétractation",
  cancellation: "Résiliation",
  report: "Signalement d’un contenu",
} as const;

export type LegalRequestKind = keyof typeof legalRequestLabels;
