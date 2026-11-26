import { query } from "../db";
import { canUseFeature } from "../beta";
export async function discordAccountAllowed(userId: string | undefined) {
  if (!userId) return false;
  const [owner] = await query(
    "SELECT a.user_id FROM primary_administrators a JOIN moderators m ON m.user_id=a.user_id WHERE a.id='main' AND a.user_id=$1 AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=a.user_id)",
    [userId],
  );
  return !!owner && (await canUseFeature(userId, "discordAccount"));
}
