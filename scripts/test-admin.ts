import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "../lib/db";
import { initialProfile } from "../lib/profile";
const base = "http://127.0.0.1:3001",
  password = "Mentora-admin-local-2026!";
type Account = { cookie: string; id: string; profileId: string };
const users: Account[] = [];
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
      .map((s) => s.split(";")[0])
      .join("; "),
  };
}
try {
  for (const role of ["mentor", "beginner", "mentor"]) {
    const suffix = randomUUID().slice(0, 8);
    const r = await call("/api/auth/sign-up/email", "POST", {
      name: "Test administration",
      email: `admin-${suffix}@example.invalid`,
      password,
    });
    assert.equal(r.status, 200);
    const u = { cookie: r.cookie, id: r.data.user.id, profileId: "" };
    users.push(u);
    const p = await call(
      "/api/me",
      "PUT",
      {
        ...initialProfile,
        role,
        experience: 12,
        specialty: ["Bot", "Fournisseur"],
        teaching: "Sourcing et calcul des marges.",
        revenue: "5 000–7 000 €",
        name: "Test administration",
        discord: `admin_${suffix}`,
        bio: "Compte temporaire pour tester la modération.",
        goals: "Tester les nouveaux parcours administrateur.",
        joined: "2020-01",
      },
      u,
    );
    assert.equal(p.status, 200);
    u.profileId = p.data.profile.id;
    assert.ok(!("joined" in p.data.profile));
    assert.deepEqual(p.data.profile.specialty, ["Bot", "Fournisseur"]);
  }
  const [mentor, beginner, admin] = users;
  await query("INSERT INTO moderators (user_id) VALUES ($1)", [admin.id]);
  assert.equal((await call("/api/admin")).status, 403);
  assert.equal(
    (await call("/api/admin", "GET", undefined, beginner)).status,
    403,
  );
  const before = (await call("/api/admin", "GET", undefined, admin)).data.stats;
  assert.equal(typeof before.accounts, "number");
  let list = (await call("/api/profiles?specialty=Bot")).data.profiles;
  assert.ok(list.some((p: any) => p.id === mentor.profileId));
  list = (await call("/api/profiles?specialty=Fournisseur")).data.profiles;
  assert.ok(list.some((p: any) => p.id === mentor.profileId));
  const report = {
    profileId: mentor.profileId,
    reason: "Informations trompeuses",
    details: "Description factuelle suffisamment détaillée pour le test.",
  };
  assert.equal((await call("/api/reports", "POST", report)).status, 401);
  assert.equal(
    (
      await call(
        "/api/reports",
        "POST",
        report,
        beginner,
        "https://evil.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/reports", "POST", report, beginner)).status,
    201,
  );
  assert.equal(
    (await call("/api/reports", "POST", report, beginner)).status,
    409,
  );
  let dashboard = (await call("/api/admin", "GET", undefined, admin)).data;
  const r = dashboard.reports.find((r: any) => r.target_id === mentor.id);
  assert.ok(r);
  assert.equal(dashboard.stats.openReports, before.openReports + 1);
  const hide = {
    action: "hide-profile",
    id: mentor.id,
    reason: "Vérification de la modération en cours.",
  };
  assert.equal((await call("/api/admin", "PATCH", hide, beginner)).status, 403);
  assert.equal((await call("/api/admin", "PATCH", hide, admin)).status, 200);
  assert.ok(
    !(await call("/api/profiles")).data.profiles.some(
      (p: any) => p.id === mentor.profileId,
    ),
  );
  assert.equal(
    (
      await call(
        `/api/profiles?contact=${mentor.profileId}`,
        "GET",
        undefined,
        beginner,
      )
    ).status,
    404,
  );
  await call("/api/me", "PATCH", { visible: true }, mentor);
  assert.ok(
    !(await call("/api/profiles")).data.profiles.some(
      (p: any) => p.id === mentor.profileId,
    ),
  );
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "POST",
        {
          mentorProfileId: mentor.profileId,
          objective: "Améliorer mes annonces et progresser dans la revente.",
        },
        beginner,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        "/api/admin",
        "PATCH",
        { ...hide, action: "restore-profile" },
        admin,
      )
    ).status,
    200,
  );
  await call(
    "/api/accompaniments",
    "POST",
    {
      mentorProfileId: mentor.profileId,
      objective: "Améliorer mes annonces et progresser dans la revente.",
    },
    beginner,
  );
  const pair = (await call("/api/accompaniments", "GET", undefined, mentor))
    .data.accompaniments[0].id;
  await call(
    "/api/accompaniments",
    "PATCH",
    { id: pair, action: "accept" },
    mentor,
  );
  dashboard = (await call("/api/admin", "GET", undefined, admin)).data;
  assert.equal(dashboard.stats.accepted, before.accepted + 1);
  assert.equal(dashboard.stats.active, before.active + 1);
  await call(
    "/api/accompaniments",
    "PATCH",
    { id: pair, action: "complete" },
    mentor,
  );
  await call(
    "/api/ratings",
    "POST",
    { accompanimentId: pair, rating: 5 },
    beginner,
  );
  dashboard = (await call("/api/admin", "GET", undefined, admin)).data;
  assert.equal(dashboard.stats.completed, before.completed + 1);
  assert.equal(dashboard.stats.ratings, before.ratings + 1);
  let p = (await call("/api/profiles")).data.profiles.find(
    (p: any) => p.id === mentor.profileId,
  );
  assert.equal(p.completedCount, 1);
  assert.equal(p.ratingCount, 1);
  assert.equal(
    (
      await call(
        "/api/admin",
        "PATCH",
        {
          action: "hide-rating",
          id: pair,
          reason: "Note masquée pour vérification du contexte.",
        },
        admin,
      )
    ).status,
    200,
  );
  p = (await call("/api/profiles")).data.profiles.find(
    (p: any) => p.id === mentor.profileId,
  );
  assert.equal(p.ratingCount, 0);
  assert.equal(p.completedCount, 1);
  assert.equal(
    (
      await call(
        "/api/ratings",
        "POST",
        { accompanimentId: pair, rating: 4 },
        beginner,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/api/admin",
        "PATCH",
        {
          action: "restore-rating",
          id: pair,
          reason: "La note peut être rétablie après examen.",
        },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/admin",
        "PATCH",
        {
          action: "resolve",
          id: r.id,
          reason: "Signalement traité après examen du profil.",
        },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/admin",
        "PATCH",
        {
          action: "dismiss",
          id: r.id,
          reason: "Deuxième décision interdite pour ce test.",
        },
        admin,
      )
    ).status,
    409,
  );
  console.log(
    "PASS: accès administrateur, statistiques, spécialités multiples, suppression de la date, signalement, masquage durable, notes masquées et restaurées, traitement unique.",
  );
} finally {
  for (const u of users) {
    await query("DELETE FROM reports WHERE reporter_id=$1 OR target_id=$1", [
      u.id,
    ]);
    await query("DELETE FROM profile_blocks WHERE user_id=$1", [u.id]);
    await query(
      "DELETE FROM hidden_ratings WHERE accompaniment_id IN (SELECT id FROM accompaniments WHERE mentor_id=$1 OR beginner_id=$1)",
      [u.id],
    );
    await call("/api/auth/delete-user", "POST", { password }, u);
    await query("DELETE FROM moderators WHERE user_id=$1", [u.id]);
  }
  console.log("Comptes de test supprimés.");
}
