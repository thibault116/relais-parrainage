import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "./auth";
import { isCrmOwner } from "./crm";

export const ownerPreviewUserId = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session && await isCrmOwner(session.user) ? session.user.id : null;
});

export async function ownerPreviewEnabled() {
  return (await ownerPreviewUserId()) !== null;
}
