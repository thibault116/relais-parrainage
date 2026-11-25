import { query } from "./db";
import { deleteProof } from "./proof-storage";
export async function deleteProfilePhoto(userId: string) {
  const row = (
    await query("SELECT details FROM profiles WHERE user_id=$1", [userId])
  )[0];
  const photo = row && JSON.parse(String(row.details)).photo;
  if (photo?.path) await deleteProof(photo.path);
  const banner=row&&JSON.parse(String(row.details)).banner;
  if(banner?.path)await deleteProof(banner.path);
}
