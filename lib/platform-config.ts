import { z } from "zod";
export const settingsSchema = z
  .object({
    discordUrl: z
      .string()
      .trim()
      .url()
      .refine((v) => {
        const u = new URL(v);
        return (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          ((u.hostname === "discord.gg" && u.pathname.length > 1) ||
            (u.hostname === "discord.com" && u.pathname.startsWith("/invite/")))
        );
      }, "Utilise un lien d’invitation Discord HTTPS."),
    announcementEnabled: z.boolean(),
    announcement: z.string().trim().max(300),
    requestsEnabled: z.boolean(),
    verifiedMentorsOnly: z.boolean(),
    suggestionsEnabled: z.boolean(),
    emailsEnabled: z.boolean(),
    vacancyEmailsEnabled: z.boolean(),
  })
  .refine((v) => !v.announcementEnabled || v.announcement.length > 0, {
    message: "Rédige une annonce avant de l’activer.",
    path: ["announcement"],
  });
export type PlatformSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: PlatformSettings = {
  discordUrl: "https://discord.gg/SRVs9Y5ze",
  announcementEnabled: false,
  announcement: "",
  requestsEnabled: true,
  verifiedMentorsOnly: false,
  suggestionsEnabled: true,
  emailsEnabled: true,
  vacancyEmailsEnabled: true,
};
export function publicSettings(s: PlatformSettings) {
  const { emailsEnabled, vacancyEmailsEnabled, ...rest } = s;
  void emailsEnabled;
  void vacancyEmailsEnabled;
  return rest;
}
