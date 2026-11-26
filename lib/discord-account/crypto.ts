import {
  createHash,
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function key() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s || s.length < 32) throw Error("Chiffrement Discord indisponible.");
  return Buffer.from(
    hkdfSync("sha256", s, "mentora", "discord-account-tokens-v1", 32),
  );
}
export function seal(value: unknown) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    c.update(JSON.stringify(value)),
    c.final(),
    c.getAuthTag(),
  ]).toString("base64url");
}
export function unseal<T>(value: string): T {
  const b = Buffer.from(value, "base64url");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(-16));
  return JSON.parse(
    Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString(),
  );
}
