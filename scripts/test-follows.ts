import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initialProfile } from "../lib/profile";
const base = "http://127.0.0.1:3001",
  password = "Test-follows-" + randomUUID();
type U = { cookie: string; id: string };
const users: U[] = [];
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  u?: U,
  origin = base,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(u ? { cookie: u.cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
try {
  for (const role of ["beginner", "mentor"]) {
    const suffix = randomUUID().slice(0, 8);
    const r = await call("/api/auth/sign-up/email", "POST", {
      name: "Test suivi",
      email: `follow-${suffix}@example.invalid`,
      password,
    });
    assert.equal(r.status, 200);
    const u = { cookie: r.cookie, id: "" };
    users.push(u);
    const p = await call(
      "/api/me",
      "PUT",
      {
        ...initialProfile,
        role,
        experience: 12,
        name: "Test suivi " + role,
        discord: "follow_" + suffix,
        bio: "Présentation temporaire pour tester les abonnements.",
        goals: "Tester les abonnements entre revendeurs.",
      },
      u,
    );
    assert.equal(p.status, 200);
    u.id = p.data.profile.id;
  }
  const [a, b] = users,
    body = { profileId: b.id };
  assert.equal((await call("/api/follows")).status, 401);
  assert.equal((await call("/api/follows", "POST", body)).status, 401);
  assert.equal(
    (await call("/api/follows", "POST", body, a, "https://example.com")).status,
    403,
  );
  assert.equal(
    (await call("/api/follows", "POST", { profileId: a.id }, a)).status,
    400,
  );
  const duplicates = await Promise.all([
    call("/api/follows", "POST", body, a),
    call("/api/follows", "POST", body, a),
  ]);
  duplicates.forEach((r) => assert.equal(r.status, 200));
  assert.equal(duplicates[1].data.followerCount, 1);
  assert.equal(
    (await call("/api/me", "GET", undefined, a)).data.profile.followingCount,
    1,
  );
  assert.equal(
    (await call("/api/me", "GET", undefined, b)).data.profile.followerCount,
    1,
  );
  let list = (await call("/api/follows?type=following", "GET", undefined, a))
    .data;
  assert.equal(list.total, 1);
  assert.equal(list.items[0].profile.id, b.id);
  assert.equal(list.items[0].profile.discord, undefined);
  assert.equal(
    (await call("/api/follows?type=followers", "GET", undefined, b)).data
      .items[0].profile.id,
    a.id,
  );
  assert.equal(
    (await call("/api/profiles?role=mentor&profile=" + b.id)).data.profile
      .followerCount,
    1,
  );
  await call("/api/me", "PATCH", { visible: false }, b);
  list = (await call("/api/follows?type=following", "GET", undefined, a)).data;
  assert.equal(list.items[0].profile, null);
  assert.equal(list.items[0].updatedAt, null);
  assert.equal(
    (await call("/api/profiles?role=mentor&profile=" + b.id)).status,
    404,
  );
  assert.equal((await call("/api/follows", "POST", body, a)).status, 404);
  assert.equal((await call("/api/follows", "DELETE", body, a)).status, 200);
  assert.equal(
    (await call("/api/me", "GET", undefined, b)).data.profile.followerCount,
    0,
  );
  await call("/api/me", "PATCH", { visible: true }, b);
  await call("/api/follows", "POST", body, a);
  await call("/api/follows", "POST", { profileId: a.id }, b);
  assert.equal(
    (await call("/api/me", "GET", undefined, a)).data.profile.followerCount,
    1,
  );
  assert.equal((await call("/api/me", "DELETE", undefined, b)).status, 200);
  assert.equal(
    (await call("/api/follows?type=following", "GET", undefined, a)).data.total,
    0,
  );
  assert.equal(
    (await call("/api/me", "GET", undefined, a)).data.profile.followerCount,
    0,
  );
  console.log(
    "PASS : abonnements des deux rôles, doublons simultanés, compteurs, listes privées, profils masqués, désabonnement, suppression et autorisations.",
  );
} finally {
  for (const u of users) {
    const r = await call("/api/auth/delete-user", "POST", { password }, u);
    assert.equal(r.status, 200);
  }
  console.log("Comptes de test supprimés.");
}
