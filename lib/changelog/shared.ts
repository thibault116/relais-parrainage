import { z } from "zod";

export const applicationUrl = "https://mentora-resell.vercel.app";
export const repository = "thibault116/relais-parrainage";
export const shaSchema = z.string().regex(/^[a-f0-9]{40}$/);
export const categories = ["Nouveautés", "Améliorations", "Corrections"] as const;
export const sectionsSchema = z.object({
  nouveautés: z.array(z.string().trim().min(3).max(350)).max(8),
  améliorations: z.array(z.string().trim().min(3).max(350)).max(8),
  corrections: z.array(z.string().trim().min(3).max(350)).max(8),
});
export type Sections = z.infer<typeof sectionsSchema>;
export const emptySections: Sections = { nouveautés: [], améliorations: [], corrections: [] };
export const reminder = "Pense à actualiser Mentora pour profiter de la dernière version.";

export function description(sections: Sections) {
  const groups = [
    ["Nouveautés", sections.nouveautés],
    ["Améliorations", sections.améliorations],
    ["Corrections", sections.corrections],
  ] as const;
  return [...groups.filter(([, notes]) => notes.length).map(([name, notes]) =>
    `**${name}**\n${notes.map((note) => `• ${note}`).join("\n")}`), reminder].join("\n\n");
}

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(150),
  sections: sectionsSchema,
}).superRefine((value, ctx) => {
  const count = Object.values(value.sections).flat().length;
  if (!count) ctx.addIssue({ code: "custom", message: "Ajoute au moins un changement visible par les membres." });
  if (description(value.sections).length > 2000)
    ctx.addIssue({ code: "custom", message: "Le texte principal dépasse 2 000 caractères, rappel compris." });
});

export function discordPayload(id: string, title: string, sections: Sections, date: string) {
  announcementSchema.parse({ title, sections });
  return {
    username: "Mentora",
    avatar_url: `${applicationUrl}/icons/icon-192.png`,
    content: "@everyone",
    allowed_mentions: { parse: ["everyone"], users: [], roles: [] },
    embeds: [{
      title,
      description: description(sections),
      url: applicationUrl,
      color: 0x883af5,
      image: { url: `${applicationUrl}/changelog-banner.png` },
      thumbnail: { url: `${applicationUrl}/icons/icon-192.png` },
      timestamp: date,
      footer: { text: `Mentora · Annonce ${id}` },
    }],
  };
}
