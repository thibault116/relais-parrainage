import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initialProfile } from "../lib/profile";
const base = process.env.TEST_URL || "http://127.0.0.1:3001";
if (!new URL(base).hostname.match(/^(127\.0\.0\.1|localhost)$/))
  throw new Error("Tests réservés à une base locale isolée.");
const stamp = randomUUID().slice(0, 8);
const password = "Relais-test-local-2026!";
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  origin = base,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await r.json();
  } catch {
    data = {};
  }
  return {
    status: r.status,
    data,
    cookie: r.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; "),
  };
}
const mentor = await call("/api/auth/sign-up/email", "POST", {
  name: "Parrain test",
  email: `mentor-${stamp}@example.invalid`,
  password,
});
assert.equal(mentor.status, 200, JSON.stringify(mentor.data));
assert.ok(mentor.cookie);
const beginner = await call("/api/auth/sign-up/email", "POST", {
  name: "Débutant test",
  email: `beginner-${stamp}@example.invalid`,
  password,
});
assert.equal(beginner.status, 200);
let id = "";
try {
  assert.equal((await call("/api/me")).status, 401);
  assert.equal(
    (await call("/api/me", "PUT", {}, mentor.cookie, "https://bad.example"))
      .status,
    403,
  );
  const p = {
    ...initialProfile,
    role: "mentor",
    name: "Parrain test",
    discord: `qa_${stamp}`,
    experience: 9,
    bio: "Profil de validation locale uniquement.",
    goals: "Accompagner les premières ventes",
    references: "Nike, Carhartt",
    specialty: ["Vintage"],
  };
  assert.equal(
    (await call("/api/me", "PUT", { ...p, experience: 2 }, mentor.cookie))
      .status,
    400,
  );
  const saved = await call("/api/me", "PUT", p, mentor.cookie);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  id = saved.data.profile.id;
  const list = await call(
    "/api/profiles?role=mentor&q=Carhartt&specialty=Vintage",
  );
  assert.ok(list.data.profiles.some((x: { id: string }) => x.id === id));
  assert.ok(!JSON.stringify(list.data).includes(p.discord));
  assert.ok(!JSON.stringify(list.data).includes("discordId"));
  assert.equal((await call("/api/profiles?contact=" + id)).status, 401);
  assert.equal(
    (
      await call(
        "/api/profiles?contact=" + id,
        "GET",
        undefined,
        beginner.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/me", "PUT", { ...p, role: "beginner" }, beginner.cookie))
      .status,
    409,
  );
  const bp = {
    ...p,
    role: "beginner",
    experience: 0,
    discord: `qb_${stamp}`,
    name: "Débutant test",
  };
  assert.equal((await call("/api/me", "PUT", bp, beginner.cookie)).status, 200);
  assert.equal(
    (
      await call(
        "/api/profiles?contact=" + id,
        "GET",
        undefined,
        beginner.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/me", "PATCH", { visible: false }, mentor.cookie)).status,
    200,
  );
  assert.ok(
    !(await call("/api/profiles?role=mentor")).data.profiles.some(
      (x: { id: string }) => x.id === id,
    ),
  );
  assert.equal(
    (
      await call(
        "/api/profiles?contact=" + id,
        "GET",
        undefined,
        beginner.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/me", "GET", undefined, mentor.cookie)).data.profile
      .visible,
    false,
  );
  assert.equal(
    (await call("/api/me", "GET", undefined, beginner.cookie)).data.profile
      .discord,
    bp.discord,
  );
  assert.equal(
    (await call("/api/me", "PATCH", { visible: true }, mentor.cookie)).status,
    200,
  );
  await call("/api/auth/sign-out", "POST", {}, mentor.cookie);
  const login = await call("/api/auth/sign-in/email", "POST", {
    email: `mentor-${stamp}@example.invalid`,
    password,
  });
  assert.equal(login.status, 200);
  mentor.cookie = login.cookie;
  assert.equal(
    (await call("/api/me", "GET", undefined, mentor.cookie)).data.profile.id,
    id,
  );
  assert.equal(
    (await call("/api/me", "DELETE", {}, mentor.cookie)).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/profiles?contact=" + id,
        "GET",
        undefined,
        beginner.cookie,
      )
    ).status,
    403,
  );
  console.log(
    "PASS : inscription, connexion, persistance, validation, isolation des comptes, confidentialité Discord, recherche, masquage, réactivation et suppression.",
  );
} finally {
  for (const u of [mentor, beginner]) {
    await call("/api/me", "DELETE", {}, u.cookie);
    await call("/api/auth/delete-user", "POST", { password }, u.cookie);
  }
}
