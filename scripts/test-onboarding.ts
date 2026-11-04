import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initialProfile } from "../lib/profile";
import { completedMonths } from "../lib/onboarding-schema";
import { query } from "../lib/db";
const base = "http://127.0.0.1:3000";
if (process.env.DATABASE_URL) throw Error("Local tests only");
const stamp = randomUUID(),
  password = "Mentora-test-local-2026!";
const users: { id: string; cookie: string }[] = [];
async function call(path: string, method = "GET", body?: unknown, cookie = "") {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { cookie } : {}),
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  };
}
async function account(n: number, beta = true) {
  const r = await call("/api/auth/sign-up/email", "POST", {
    name: "Test inscription",
    email: `intake-${stamp}-${n}@example.invalid`,
    password,
  });
  assert.equal(r.status, 200);
  const u = { id: r.data.user.id, cookie: r.cookie };
  users.push(u);
  if (beta)
    assert.equal(
      (await call("/api/beta", "PUT", { enabled: true }, u.cookie)).status,
      200,
    );
  return u;
}
async function image(cookie: string) {
  const f = new FormData();
  f.set(
    "file",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
          "base64",
        ),
      ],
      "test.png",
      { type: "image/png" },
    ),
  );
  const r = await call("/api/verification-files", "POST", f, cookie);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.file.id as string;
}
const normal = {
  ...initialProfile,
  name: "Test inscription",
  discord: "intake_" + stamp.slice(0, 8),
  bio: "Profil de test local uniquement.",
  goals: "Progresser dans les ventes.",
  experience: 12,
  specialty: ["Vintage"],
};
try {
  const mentor = await account(1),
    beginner = await account(2),
    legacy = await account(3, false);
  const mq = {
    version: 1,
    role: "mentor",
    started: "2020-01",
    record: 5000,
    specialtyOther: "",
    platforms: "Vinted et eBay",
    brands: "Nike et Levi’s : jeans et vestes.",
    model: "Niche",
    modelOther: "",
    audience: ["Débutants"],
    calls: true,
    flexText: "Une belle progression sur six mois.",
    flexFile: "",
    categories: ["Vintage"],
    categoryOther: "",
    months: [] as {
      month: string;
      revenue: number;
      profit: number;
      basket: number;
      roi: number;
      files: string[];
    }[],
  };
  for (const month of completedMonths())
    mq.months.push({
      month,
      revenue: 1500,
      profit: 500,
      basket: 30,
      roi: 50,
      files: [await image(mentor.cookie)],
    });
  const payload = { ...normal, role: "mentor", questionnaire: mq };
  assert.equal(
    (await call("/api/me", "PUT", payload, legacy.cookie)).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/me",
        "PUT",
        { ...normal, discord: normal.discord + "_old" },
        legacy.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/me",
        "PUT",
        {
          ...payload,
          questionnaire: {
            ...mq,
            started: new Date().toISOString().slice(0, 7),
          },
        },
        mentor.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/me",
        "PUT",
        { ...payload, questionnaire: { ...mq, months: mq.months.slice(1) } },
        mentor.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/me",
        "PUT",
        {
          ...payload,
          questionnaire: {
            ...mq,
            months: mq.months.map((m, i) =>
              i === 0 ? { ...m, files: [] } : m,
            ),
          },
        },
        mentor.cookie,
      )
    ).status,
    400,
  );
  const stranger = await image(beginner.cookie);
  assert.equal(
    (
      await call(
        "/api/me",
        "PUT",
        {
          ...payload,
          questionnaire: {
            ...mq,
            months: mq.months.map((m, i) =>
              i === 0 ? { ...m, files: [stranger] } : m,
            ),
          },
        },
        mentor.cookie,
      )
    ).status,
    400,
  );
  const saved = await call("/api/me", "PUT", payload, mentor.cookie);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const owner = await call("/api/me", "GET", undefined, mentor.cookie);
  assert.equal(owner.data.profile.questionnaire.months.length, 6);
  const publicData = await call(
    "/api/profiles?profile=" + saved.data.profile.id,
  );
  assert.ok(JSON.stringify(publicData.data).includes("1500"));
  for (const m of mq.months)
    assert.ok(!JSON.stringify(publicData.data).includes(m.files[0]));
  assert.ok(!JSON.stringify(publicData.data).includes("questionnaire"));
  const privateCapture = await fetch(
    base + "/api/verification-files?id=" + mq.months[0].files[0],
    { headers: { cookie: beginner.cookie } },
  );
  assert.equal(privateCapture.status, 403);
  assert.equal(
    (
      await call(
        "/api/verification-files",
        "DELETE",
        { id: mq.months[0].files[0] },
        mentor.cookie,
      )
    ).status,
    409,
  );
  const bq = {
    version: 1,
    role: "beginner",
    categories: ["Sneakers", "Autre"],
    categoryOther: "Accessoires",
    experienceText: "Je débute après quelques ventes de vêtements personnels.",
    objectives: "Je souhaite apprendre à acheter et revendre régulièrement.",
    support: ["Suivi régulier"],
    supportOther: "",
    blocker: "Je ne sais pas encore déterminer un prix d’achat rentable.",
    exchange: "Message vocal",
    cash: 350,
  };
  await query(
    "INSERT INTO profiles(id,user_id,discord,role,name,details,visible,updated_at) VALUES($1,$2,$3,'beginner',$4,$5,1,$6)",
    [
      randomUUID(),
      legacy.id,
      normal.discord + "_old",
      normal.name,
      JSON.stringify(normal),
      new Date().toISOString(),
    ],
  );
  assert.equal(
    (await call("/api/me", "GET", undefined, legacy.cookie)).data
      .requiresQuestionnaire,
    true,
  );
  const refreshed = await call(
    "/api/me",
    "PUT",
    { ...normal, discord: normal.discord + "_old", questionnaire: bq },
    legacy.cookie,
  );
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
  assert.equal(
    (await call("/api/me", "GET", undefined, legacy.cookie)).data
      .requiresQuestionnaire,
    false,
  );
  await query("DELETE FROM onboarding_confirmations WHERE user_id=$1", [
    legacy.id,
  ]);
  assert.equal(
    (await call("/api/me", "GET", undefined, legacy.cookie)).data
      .requiresQuestionnaire,
    true,
  );
  assert.equal(
    (
      await call(
        "/api/me",
        "PUT",
        { ...normal, discord: normal.discord + "_old" },
        legacy.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("/api/me", "GET", undefined, legacy.cookie)).data
      .requiresQuestionnaire,
    true,
  );
  const bp = { ...normal, discord: normal.discord + "_b", questionnaire: bq };
  assert.equal(
    (
      await call(
        "/api/me",
        "PUT",
        { ...bp, questionnaire: { ...bq, blocker: "court" } },
        beginner.cookie,
      )
    ).status,
    400,
  );
  const bs = await call("/api/me", "PUT", bp, beginner.cookie);
  assert.equal(bs.status, 200, JSON.stringify(bs.data));
  assert.ok(
    JSON.stringify(
      (await call("/api/profiles?role=beginner&profile=" + bs.data.profile.id))
        .data,
    ).includes("350"),
  );
  assert.equal(
    (await call("/api/onboarding", "GET", undefined, beginner.cookie)).status,
    403,
  );
  await query("INSERT INTO moderators(user_id) VALUES($1)", [legacy.id]);
  const admin = await call("/api/onboarding", "GET", undefined, legacy.cookie);
  assert.equal(admin.status, 200);
  assert.ok(
    admin.data.items.some((i: { userId: string }) => i.userId === mentor.id),
  );
  const adminCapture = await fetch(
    base + "/api/verification-files?id=" + mq.months[0].files[0],
    { headers: { cookie: legacy.cookie } },
  );
  assert.equal(adminCapture.status, 200);
  await call("/api/beta", "PUT", { enabled: false }, mentor.cookie);
  assert.equal(
    (await call("/api/me", "PUT", payload, mentor.cookie)).status,
    200,
  );
  assert.equal(
    (await call("/api/me", "GET", undefined, mentor.cookie)).data.profile
      .questionnaire.months.length,
    6,
  );
  console.log(
    "Onboarding passed: mandatory renewal, non-beta access, legacy-profile enforcement, experience, six months/screens, ownership, private proofs, public figures, beginner minimums, admin access, opt-out preservation.",
  );
} finally {
  for (const u of users) {
    await query("DELETE FROM moderators WHERE user_id=$1", [u.id]);
    await call("/api/auth/delete-user", "POST", { password }, u.cookie);
    assert.equal(
      (
        await query("SELECT user_id FROM onboarding_answers WHERE user_id=$1", [
          u.id,
        ])
      ).length,
      0,
    );
  }
}
