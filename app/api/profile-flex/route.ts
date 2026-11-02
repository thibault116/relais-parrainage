import { query } from "@/lib/db";
import { json } from "@/lib/http";
import { readProof } from "@/lib/proof-storage";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const [row] = await query(
      `SELECT a.answers,p.user_id FROM profiles p JOIN onboarding_answers a ON a.user_id=p.user_id WHERE p.id=$1 AND p.visible=1 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)`,
      [id],
    );
    if (!row) return json({ error: "Image indisponible." }, 404);
    const a = JSON.parse(String(row.answers));
    if (a.role !== "mentor" || !a.flexFile)
      return json({ error: "Image indisponible." }, 404);
    const [f] = await query(
      "SELECT stored_path,mime FROM verification_files WHERE id=$1 AND user_id=$2",
      [a.flexFile, String(row.user_id)],
    );
    if (!f || !String(f.mime).startsWith("image/"))
      return json({ error: "Image indisponible." }, 404);
    const body = await readProof(String(f.stored_path));
    if (!body) return json({ error: "Image indisponible." }, 404);
    return new Response(body, {
      headers: {
        "Content-Type": String(f.mime),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return json({ error: "Image indisponible." }, 503);
  }
}
