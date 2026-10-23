import { getAuth } from "./auth";
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function user(request: Request) {
  return (await getAuth().api.getSession({ headers: request.headers }))?.user;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (
    origin === new URL(request.url).origin ||
    (!!process.env.BETTER_AUTH_URL && origin === process.env.BETTER_AUTH_URL)
  );
}
export async function guard(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Origine de la requête refusée." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 20000)
    return json({ error: "Formulaire trop volumineux." }, 413);
  return null;
}
