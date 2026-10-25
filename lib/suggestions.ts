import { query } from "./db";
import { deleteProof } from "./proof-storage";
export async function deleteSuggestions(userId: string) {
  const rows = await query(
    "SELECT attachment FROM suggestions WHERE user_id=$1",
    [userId],
  );
  for (const row of rows) {
    const attachment = row.attachment && JSON.parse(String(row.attachment));
    if (attachment?.path) await deleteProof(attachment.path);
  }
  await query("DELETE FROM suggestions WHERE user_id=$1", [userId]);
}
