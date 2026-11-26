import { NextResponse } from "next/server";
import { actor, failure } from "@/lib/discord-account/http";
import { begin, returnPath } from "@/lib/discord-account/service";
import { SITE_ORIGIN } from "@/lib/site";
export const runtime = "nodejs";
export async function GET(r: Request) {
  const a = await actor(r);
  if (!a)
    return NextResponse.redirect(
      new URL(
        returnPath.replace("#profile", "&discord=login#profile"),
        SITE_ORIGIN,
      ),
    );
  try {
    const start = await begin(a);
    const out = NextResponse.redirect(start.url);
    out.headers.set("Cache-Control", "private, no-store");
    out.headers.set("Referrer-Policy", "no-referrer");
    out.cookies.set("mentora-discord-flow", start.cookie, {
      httpOnly: true,
      secure: new URL(r.url).protocol === "https:",
      sameSite: "lax",
      path: "/api/discord-account",
      maxAge: 600,
    });
    return out;
  } catch (e) {
    return failure(e);
  }
}
