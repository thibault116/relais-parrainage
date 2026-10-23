import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initialProfile } from "../lib/profile";
const base = "http://127.0.0.1:3001",
  password = "Test-ratings-local-2026!";
type Account = { cookie: string; id: string };
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  u?: Account,
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
      .map((x) => x.split(";")[0])
      .join("; "),
  };
}
const users: Account[] = [];
try {
  for (const role of ["mentor", "beginner", "beginner"]) {
    const suffix = randomUUID().slice(0, 8);
    const res = await call("/api/auth/sign-up/email", "POST", {
      email: `ratings-${suffix}@example.invalid`,
      name: "Test notes",
      password,
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const u = { cookie: res.cookie, id: "" };
    users.push(u);
    const p = await call(
      "/api/me",
      "PUT",
      {
        ...initialProfile,
        role,
        experience: 8,
        name: "Test notes",
        discord: `rating_${suffix}`,
        bio: "Compte de test local des accompagnements.",
        goals: "Tester le cycle complet de notation.",
      },
      u,
    );
    assert.equal(p.status, 200);
    u.id = p.data.profile.id;
  }
  const [mentor, beginner, outsider] = users;
  assert.equal((await call("/api/accompaniments")).status, 401);
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "POST",
        { mentorProfileId: mentor.id },
        mentor,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "POST",
        { mentorProfileId: mentor.id },
        beginner,
        "https://evil.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "POST",
        { mentorProfileId: mentor.id },
        beginner,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "POST",
        { mentorProfileId: mentor.id },
        beginner,
      )
    ).status,
    409,
  );
  const pairs = await call("/api/accompaniments", "GET", undefined, beginner);
  const id = pairs.data.accompaniments[0].id;
  assert.equal(
    (await call("/api/accompaniments", "GET", undefined, outsider)).data
      .accompaniments.length,
    0,
  );
  assert.equal(
    (
      await call(
        "/api/ratings",
        "POST",
        { accompanimentId: id, rating: 5 },
        beginner,
      )
    ).status,
    409,
  );
  for (const u of [beginner, outsider])
    assert.equal(
      (await call("/api/accompaniments", "PATCH", { id, action: "accept" }, u))
        .status,
      409,
    );
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "PATCH",
        { id, action: "complete" },
        mentor,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "PATCH",
        { id, action: "accept" },
        mentor,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/ratings",
        "POST",
        { accompanimentId: id, rating: 5 },
        beginner,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "PATCH",
        { id, action: "complete" },
        outsider,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "PATCH",
        { id, action: "complete" },
        beginner,
      )
    ).status,
    200,
  );
  for (const u of [mentor, outsider])
    assert.equal(
      (
        await call(
          "/api/ratings",
          "POST",
          { accompanimentId: id, rating: 5 },
          u,
        )
      ).status,
      409,
    );
  for (const rating of [0, 6, 2.5, "5"])
    assert.equal(
      (
        await call(
          "/api/ratings",
          "POST",
          { accompanimentId: id, rating },
          beginner,
        )
      ).status,
      400,
    );
  const results = await Promise.all([
    call("/api/ratings", "POST", { accompanimentId: id, rating: 4 }, beginner),
    call("/api/ratings", "POST", { accompanimentId: id, rating: 4 }, beginner),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [201, 409]);
  let profile = (await call("/api/profiles?role=mentor")).data.profiles.find(
    (p: { id: string }) => p.id === mentor.id,
  );
  assert.equal(profile.ratingCount, 1);
  assert.equal(profile.ratingAverage, 4);
  await call("/api/me", "PATCH", { visible: false }, mentor);
  assert.ok(
    !(await call("/api/profiles?role=mentor")).data.profiles.some(
      (p: { id: string }) => p.id === mentor.id,
    ),
  );
  await call("/api/me", "PATCH", { visible: true }, mentor);
  profile = (await call("/api/profiles?role=mentor")).data.profiles.find(
    (p: { id: string }) => p.id === mentor.id,
  );
  assert.equal(profile.ratingCount, 1);
  console.log(
    "PASS : demandes, confirmation par le parrain, fin, autorisations, notes 1–5, doublons simultanés, moyenne publique, masquage et conservation.",
  );
} finally {
  for (const u of users)
    await call("/api/auth/delete-user", "POST", { password }, u);
  console.log("Comptes de test supprimés.");
}
