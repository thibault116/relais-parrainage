import { NextRequest, NextResponse } from "next/server";
import { actor } from "@/lib/discord-account/http";
import {
  complete,
  returnPath,
  AccountError,
} from "@/lib/discord-account/service";
import { SITE_ORIGIN } from "@/lib/site";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(r: NextRequest) {
  let result = "connected";
  try {
    const a = await actor(r);
    if (!a) throw new AccountError("expired");
    await complete(
      a,
      r.nextUrl.searchParams,
      r.cookies.get("mentora-discord-flow")?.value || "",
    );
  } catch (e) {
    result = e instanceof AccountError ? e.code : "unavailable";
  }
  const url = new URL(returnPath, SITE_ORIGIN);
  url.searchParams.set("discord", result);
  const out = NextResponse.redirect(url);
  out.headers.set("Cache-Control", "private, no-store");
  out.headers.set("Referrer-Policy", "no-referrer");
  out.cookies.set("mentora-discord-flow", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/discord-account",
    maxAge: 0,
  });
  return out;
}
