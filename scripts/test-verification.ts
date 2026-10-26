import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "../lib/db";
import { initialProfile } from "../lib/profile";
const base = "http://127.0.0.1:3001",
  password = "Mentora-test-verification-2026!";
type Account = { cookie: string; id: string; profileId: string };
if (process.env.DATABASE_URL || process.env.VERCEL) throw Error("Local only");
const settingsSnapshot = (
  await query("SELECT * FROM platform_settings WHERE id='main'")
)[0];
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
  for (const role of ["mentor", "mentor", "beginner"]) {
    const suffix = randomUUID().slice(0, 8);
    const r = await call("/api/auth/sign-up/email", "POST", {
      name: "Vérification test",
      email: `verification-${suffix}@example.invalid`,
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
        experience: 8,
        name: "Vérification test",
        discord: `verify_${suffix}`,
        bio: "Compte temporaire de test du contrôle des parrains.",
        goals: "Tester la vérification confidentielle.",
      },
      u,
    );
    assert.equal(p.status, 200);
    u.profileId = p.data.profile.id;
  }
  const [mentor, admin, outsider] = users;
  await query("INSERT INTO moderators (user_id) VALUES ($1)", [admin.id]);
  assert.equal((await call("/api/admin/settings")).status, 403);
  assert.equal(
    (await call("/api/admin/settings", "GET", undefined, outsider)).status,
    403,
  );
  const config = (await call("/api/admin/settings", "GET", undefined, admin))
    .data;
  const update = {
    revision: config.revision,
    settings: {
      ...config.settings,
      requestsEnabled: false,
      suggestionsEnabled: false,
      announcementEnabled: true,
      announcement: "Annonce de test locale",
    },
  };
  assert.equal(
    (
      await call(
        "/api/admin/settings",
        "PUT",
        update,
        admin,
        "https://bad.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/admin/settings",
        "PUT",
        {
          ...update,
          settings: { ...update.settings, discordUrl: "javascript:alert(1)" },
        },
        admin,
      )
    ).status,
    400,
  );
  const changed = await call("/api/admin/settings", "PUT", update, admin);
  assert.equal(changed.status, 200);
  assert.equal(
    (await call("/api/admin/settings", "PUT", update, admin)).status,
    409,
  );
  const visible = (await call("/api/settings")).data;
  assert.equal(visible.announcement, "Annonce de test locale");
  assert(!("emailsEnabled" in visible));
  assert.equal(
    (
      await call(
        "/api/accompaniments",
        "POST",
        {
          mentorProfileId: mentor.profileId,
          objective: "Objectif du test local",
        },
        outsider,
      )
    ).status,
    403,
  );
  const suggestions = await fetch(base + "/api/suggestions", {
    method: "POST",
    headers: { Origin: base, cookie: outsider.cookie },
    body: new FormData(),
  });
  assert.equal(suggestions.status, 403);
  assert.equal(
    (
      await call(
        "/api/admin/settings",
        "PUT",
        { settings: config.settings, revision: changed.data.revision },
        admin,
      )
    ).status,
    200,
  );
  const form = new FormData();
  form.append(
    "file",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6fWQAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "preuve.png",
  );
  const uploaded = await fetch(base + "/api/verification-files", {
    method: "POST",
    headers: { Origin: base, cookie: mentor.cookie },
    body: form,
  });
  assert.equal(uploaded.status, 201);
  const fileId = (await uploaded.json()).file.id;
  assert.equal(
    (await fetch(base + "/api/verification-files?id=" + fileId)).status,
    401,
  );
  assert.equal(
    (
      await fetch(base + "/api/verification-files?id=" + fileId, {
        headers: { cookie: outsider.cookie },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/verification-files?id=" + fileId, {
        headers: { cookie: admin.cookie },
      })
    ).status,
    403,
  );
  const body = {
    version: 2,
    experience: "Moins de 6 mois",
    platforms: ["Vinted", "eBay"],
    salesRange: "50 à 200",
    helpAreas: ["Brocante", "Autre"],
    otherHelp: "Photos",
    motivation: "Motivation confidentielle ".repeat(1100),
    proofs: [{ type: "Photo de colis", links: [], files: [fileId] }],
    consent: true,
  };
  assert.equal(
    (
      await call(
        "/api/verification",
        "POST",
        { ...body, otherHelp: "" },
        mentor,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/verification",
        "POST",
        { ...body, proofs: [{ type: "Photo de colis", links: [], files: [] }] },
        mentor,
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("/api/verification", "POST", body, admin)).status,
    400,
  );
  assert.equal((await call("/api/verification")).status, 401);
  assert.equal((await call("/api/moderation")).status, 403);
  assert.equal(
    (await call("/api/moderation", "GET", undefined, mentor)).status,
    403,
  );
  assert.equal(
    (await call("/api/verification", "POST", body, outsider)).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/verification",
        "POST",
        {
          ...body,
          proofs: [
            {
              type: "Photo de colis",
              links: ["javascript:alert(1)"],
              files: [],
            },
          ],
        },
        mentor,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/verification",
        "POST",
        body,
        mentor,
        "https://example.com",
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/verification", "POST", body, mentor)).status,
    200,
  );
  assert.equal(
    (await call("/api/verification", "GET", undefined, outsider)).data
      .verification,
    null,
  );
  assert.equal(
    (
      await fetch(base + "/api/verification-files?id=" + fileId, {
        headers: { cookie: admin.cookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/api/verification-files", "DELETE", { id: fileId }, mentor))
      .status,
    409,
  );
  let row = (
    await call("/api/moderation", "GET", undefined, admin)
  ).data.dossiers.find((r: any) => r.user_id === mentor.id);
  const decision = {
    userId: mentor.id,
    revision: row.revision,
    action: "approve",
    sales: 0,
    specialties: ["Brocante"],
    feedback: "Historique examiné et conseils cohérents avec la spécialité.",
    checked: true,
  };
  assert.equal(
    (await call("/api/moderation", "PATCH", decision, mentor)).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/moderation",
        "PATCH",
        { ...decision, specialties: ["Luxe"] },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/moderation",
        "PATCH",
        { ...decision, checked: false },
        admin,
      )
    ).status,
    400,
  );
  const approved = await call(
    "/api/moderation",
    "PATCH",
    { ...decision, feedback: "" },
    admin,
  );
  assert.equal(approved.status, 200);
  assert.equal(approved.data.verification.status, "approved");
  assert.notEqual(approved.data.verification.revision, decision.revision);
  assert.equal(
    (await call("/api/moderation", "PATCH", decision, admin)).status,
    409,
  );
  let publicData = (await call("/api/profiles?role=mentor")).data;
  let profile = publicData.profiles.find((p: any) => p.id === mentor.profileId);
  assert.equal(profile.verification.sales, null);
  assert.deepEqual(profile.verification.specialties, ["Brocante"]);
  assert.ok(!JSON.stringify(publicData).includes("justificatif-prive-test"));
  assert.ok(!JSON.stringify(publicData).includes(body.motivation));
  assert.equal(
    (await call("/api/me", "GET", undefined, mentor)).data.profile.verification
      .sales,
    null,
  );
  // Resubmission removes old approval and protects the new revision against stale decisions.
  assert.equal(
    (await call("/api/verification", "POST", body, mentor)).status,
    200,
  );
  assert.equal(
    (await call("/api/me", "GET", undefined, mentor)).data.profile.verification,
    null,
  );
  assert.equal(
    (await call("/api/moderation", "PATCH", decision, admin)).status,
    409,
  );
  await call(
    "/api/verification",
    "POST",
    {
      ...body,
      proofs: [
        {
          type: "Photo de colis",
          links: ["https://example.com/proof"],
          files: [],
        },
      ],
    },
    admin,
  );
  row = (await call("/api/verification", "GET", undefined, admin)).data
    .verification;
  assert.equal(
    (
      await call(
        "/api/moderation",
        "PATCH",
        { ...decision, userId: admin.id, revision: row.revision },
        admin,
      )
    ).status,
    403,
  );
  await query("UPDATE moderators SET email=$1 WHERE user_id=$2", [
    "thibault.cordiez@hotmail.com",
    admin.id,
  ]);
  const ownApproval = await call(
    "/api/moderation",
    "PATCH",
    { ...decision, userId: admin.id, revision: row.revision },
    admin,
  );
  assert.equal(ownApproval.status, 200);
  assert.equal(ownApproval.data.verification.status, "approved");
  assert(
    (await call("/api/me", "GET", undefined, admin)).data.profile.verification,
  );
  assert.equal(
    (await call("/api/verification", "DELETE", undefined, mentor)).status,
    200,
  );
  assert.equal(
    (await call("/api/verification", "GET", undefined, mentor)).data
      .verification,
    null,
  );
  assert.equal(
    (
      await fetch(base + "/api/verification-files?id=" + fileId, {
        headers: { cookie: mentor.cookie },
      })
    ).status,
    404,
  );
  console.log(
    "PASS: accès privés, justificatifs non publics, questionnaire multiple, motivation longue, import privé et suppression, spécialités, validation humaine, auto-validation réservée au propriétaire, paramètres protégés, pause des demandes et suggestions, conflits, retrait et renvoi.",
  );
} finally {
  await query(
    "UPDATE platform_settings SET data=$1,revision=$2,updated_at=$3,updated_by=$4 WHERE id='main'",
    [
      String(settingsSnapshot.data),
      String(settingsSnapshot.revision),
      String(settingsSnapshot.updated_at),
      settingsSnapshot.updated_by ? String(settingsSnapshot.updated_by) : null,
    ],
  );
  for (const u of users) {
    await call("/api/auth/delete-user", "POST", { password }, u);
    await query("DELETE FROM moderators WHERE user_id=$1", [u.id]);
  }
  console.log("Comptes de test supprimés.");
}
