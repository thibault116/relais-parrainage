import {actor,failure} from "@/lib/discord-account/http";
import { json, guard } from "@/lib/http";
import {
  begin,
  read,
  sync,
  unlink,
} from "@/lib/discord-account/service";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(r: Request) {
  const a = await actor(r);
  if (!a) return json({ error: "Connecte-toi à Mentora." }, 401);
  try {
    return json(await read(a));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  const denied = await guard(r);
  if (denied) return denied;
  const a = await actor(r);
  if (!a) return json({ error: "Connecte-toi à Mentora." }, 401);
  try {
    const d = await r.json();
    if (d.action === "sync") {
      await sync(a);
      return json(await read(a));
    }
    if (d.action === "unlink") {
      await unlink(a);
      return json(await read(a));
    }
    if (d.action === "connect") {
      const start = await begin(a);
      const out = NextResponse.json(
        { url: start.url },
        { headers: { "Cache-Control": "private, no-store" } },
      );
      out.cookies.set("mentora-discord-flow", start.cookie, {
        httpOnly: true,
        secure: new URL(r.url).protocol === "https:",
        sameSite: "lax",
        path: "/api/discord-account",
        maxAge: 600,
      });
      return out;
    }
    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return failure(e);
  }
}
