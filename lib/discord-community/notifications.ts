import { query } from "../db";
import { config } from "../discord-tickets/store";
import { discordApi, type DiscordApi } from "../discord-tickets/client";
export type NotificationKind = "updates" | "announcements";
const snowflake = /^\d{15,22}$/;

// Use exactly the IDs assigned by the two opt-in buttons. Never fall back to everyone.
export async function notificationRoles(makeMentionable = false, api: DiscordApi = discordApi) {
  const c = await config();
  const [panel] = await query("SELECT details FROM discord_community_panels WHERE kind='roles'");
  const saved = JSON.parse(String(panel?.details || "{}"));
  if (!c || !snowflake.test(saved.updates || "") || !snowflake.test(saved.announcements || "") || saved.updates === saved.announcements || [saved.updates,saved.announcements].includes(c.guild_id))
    throw Error("Configure les deux rôles de notification dans Tickets Discord → Rôles.");
  const roles = await api<{id:string;permissions:string;managed?:boolean;mentionable?:boolean}[]>(`/guilds/${c.guild_id}/roles`);
  const kinds: NotificationKind[] = ["updates", "announcements"];
  for (const kind of kinds) {
    const role = roles.find(r=>r.id === saved[kind]);
    if (!role || role.managed || role.permissions !== "0")
      throw Error("Un rôle de notification est absent ou contient des permissions. Vérifie les rôles Discord.");
  }
  if (makeMentionable) for (const kind of kinds) {
    const role = roles.find(r=>r.id === saved[kind])!;
    if (!role.mentionable) {
      const changed = await api<{mentionable:boolean}>(`/guilds/${c.guild_id}/roles/${role.id}`, "PATCH", {mentionable:true});
      if (!changed.mentionable) throw Error("Discord n’a pas confirmé la mention du rôle de notification.");
    }
  }
  return { updates: String(saved.updates), announcements: String(saved.announcements) };
}
