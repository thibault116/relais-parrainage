import { z } from "zod";
export const experienceOptions = [
  "Moins de 6 mois",
  "De 6 mois à 1 an",
  "De 1 an à 2 ans",
  "De 2 ans à 3 ans",
  "Plus de 3 ans",
] as const;
export const platformOptions = [
  "Vinted",
  "Le Bon Coin",
  "eBay",
  "Whatnot",
  "TikTok",
  "Vestiaire Collective",
  "Depop",
] as const;
export const salesOptions = [
  "50 à 200",
  "200 à 500",
  "500 à 1 000",
  "Plus de 1 500",
] as const;
export const helpOptions = [
  "Sourcing fournisseur",
  "Bot Vinted",
  "Estimation et prix",
  "Création d’annonce",
  "Expert en photo",
  "Expédition",
  "Logistique",
  "Gestion et organisation",
  "Développement des ventes",
  "Délégation",
  "Trouver des niches",
  "Brocante",
  "Autre",
] as const;
export const proofOptions = [
  "Capture de mon porte-monnaie Vinted ou historique des ventes",
  "Capture de mon dashboard de suivi des ventes",
  "Photo de colis",
  "Lien vers mon profil vendeur avec avis",
  "Autre preuve",
] as const;
export const dossierSchema = z
  .object({
    version: z.literal(2),
    experience: z.enum(experienceOptions),
    platforms: z
      .array(z.enum(platformOptions))
      .min(1, "Sélectionne au moins une plateforme.")
      .max(platformOptions.length),
    salesRange: z.enum(salesOptions),
    helpAreas: z
      .array(z.enum(helpOptions))
      .min(1, "Choisis au moins un domaine.")
      .max(helpOptions.length),
    otherHelp: z.string().trim(),
    motivation: z
      .string()
      .trim()
      .min(
        1,
        "Explique en quelques mots pourquoi tu souhaites devenir parrain.",
      ),
    proofs: z
      .array(
        z
          .object({
            type: z.enum(proofOptions),
            links: z
              .array(
                z
                  .string()
                  .trim()
                  .url()
                  .refine(
                    (v) => new URL(v).protocol === "https:",
                    "Utilise un lien HTTPS.",
                  ),
              )
              .max(10),
            files: z.array(z.string().uuid()).max(12),
          })
          .refine(
            (p) => p.links.length + p.files.length > 0,
            "Ajoute un lien ou un fichier pour chaque type de preuve sélectionné.",
          ),
      )
      .min(1, "Ajoute au moins un justificatif.")
      .max(proofOptions.length),
    consent: z.literal(true),
  })
  .superRefine((d, ctx) => {
    if (d.helpAreas.includes("Autre") && !d.otherHelp)
      ctx.addIssue({
        code: "custom",
        path: ["otherHelp"],
        message: "Précise le domaine « Autre ».",
      });
    if (new Set(d.proofs.map((p) => p.type)).size !== d.proofs.length)
      ctx.addIssue({
        code: "custom",
        path: ["proofs"],
        message: "Sélectionne chaque type de preuve une seule fois.",
      });
  });
export type Dossier = z.infer<typeof dossierSchema>;
