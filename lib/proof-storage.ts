import { put, get, del } from "@vercel/blob";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { query } from "./db";
export async function saveProof(id: string, bytes: Buffer, mime: string) {
  if (
    process.env.VERCEL ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_STORE_ID
  ) {
    const result = await put(`verification/${id}`, bytes, {
      access: "private",
      contentType: mime,
      addRandomSuffix: false,
    });
    return result.pathname;
  }
  await mkdir(".data/proofs", { recursive: true });
  await writeFile(`.data/proofs/${id}`, bytes, { mode: 0o600 });
  return `local:${id}`;
}
export async function readProof(path: string) {
  if (path.startsWith("local:")) {
    if (process.env.VERCEL) throw Error("Invalid storage");
    return new Uint8Array(await readFile(`.data/proofs/${path.slice(6)}`));
  }
  const result = await get(path, { access: "private" });
  return result?.statusCode === 200 ? result.stream : null;
}
export async function deleteProof(path: string) {
  if (path.startsWith("local:")) {
    if (process.env.VERCEL) throw Error("Invalid storage");
    await unlink(`.data/proofs/${path.slice(6)}`).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  } else await del(path);
}
export async function deleteUserProofs(userId: string) {
  const files = await query(
    "SELECT id,stored_path FROM verification_files WHERE user_id=$1",
    [userId],
  );
  for (const f of files) {
    await deleteProof(String(f.stored_path));
    await query("DELETE FROM verification_files WHERE id=$1", [String(f.id)]);
  }
}
export function detectProofType(b: Buffer) {
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString()))
    return "image/gif";
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (
    b.subarray(4, 8).toString() === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(
      b.subarray(8, 12).toString(),
    )
  )
    return "image/heic";
  return null;
}
