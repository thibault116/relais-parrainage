import { syncSchema, ingestCrm } from "@/lib/crm";
export const runtime = "nodejs";
function cors(r: Request): Record<string, string> {
  const origin = r.headers.get("origin");
  return origin && /^chrome-extension:\/\/[a-p]{32}$/.test(origin)
    ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : {};
}
function reply(r: Request, data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { ...cors(r), "Cache-Control": "no-store" },
  });
}
export async function OPTIONS(r: Request) {
  if (!Object.keys(cors(r)).length)
    return reply(r, { error: "Origine refusée." }, 403);
  return new Response(null, {
    status: 204,
    headers: {
      ...cors(r),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}
export async function POST(r: Request) {
  try {
    const origin = r.headers.get("origin");
    if (origin && !Object.keys(cors(r)).length)
      return reply(r, { error: "Origine refusée." }, 403);
    const auth = r.headers.get("authorization") || "";
    if (!/^Bearer [a-f0-9]{64}$/.test(auth))
      return reply(r, { error: "Connexion extension requise." }, 401);
    if (Number(r.headers.get("content-length") || 0) > 250000)
      return reply(r, { error: "Lot trop volumineux." }, 413);
    const raw = await r.text();
    if (new TextEncoder().encode(raw).length > 250000)
      return reply(r, { error: "Lot trop volumineux." }, 413);
    const parsed = syncSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return reply(r, { error: "Données de vente invalides." }, 400);
    return reply(r, await ingestCrm(auth.slice(7), parsed.data));
  } catch (e) {
    const m = (e as Error).message;
    return reply(
      r,
      {
        error:
          m === "unauthorized"
            ? "Clé expirée ou révoquée."
            : m === "account_mismatch"
              ? "Ce CRM est déjà associé à un autre compte Vinted."
              : e instanceof SyntaxError
                ? "JSON invalide."
                : "Synchronisation impossible.",
      },
      m === "unauthorized"
        ? 401
        : m === "account_mismatch"
          ? 409
          : e instanceof SyntaxError
            ? 400
            : 503,
    );
  }
}
