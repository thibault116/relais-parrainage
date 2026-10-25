import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "../lib/db";
import { initialProfile } from "../lib/profile";
const base = "http://127.0.0.1:3001",
  password = "Test-suggestions-" + randomUUID();
type U = { id: string; cookie: string };
const users: U[] = [];
async function call(path: string, method = "GET", body?: unknown, u?: U) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
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
async function send(
  id: string,
  u?: U,
  withFile = false,
  origin = base,
  text = "Ajouter des conseils photo pour les annonces Vinted.",
) {
  const f = new FormData();
  f.append("id", id);
  f.append("message", text);
  f.append("page", "home");
  if (withFile)
    f.append(
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
      "photo.png",
    );
  return fetch(base + "/api/suggestions", {
    method: "POST",
    headers: { Origin: origin, ...(u ? { cookie: u.cookie } : {}) },
    body: f,
  });
}
try {
  for (let i = 0; i < 2; i++) {
    const r = await call("/api/auth/sign-up/email", "POST", {
      name: "Test suggestion",
      email: `suggest-${randomUUID()}@example.invalid`,
      password,
    });
    assert.equal(r.status, 200);
    users.push({ id: r.data.user.id, cookie: r.cookie });
  }
  const [member, admin] = users;
  await query("INSERT INTO moderators (user_id) VALUES ($1)", [admin.id]);
  const profile = await call(
    "/api/me",
    "PUT",
    {
      ...initialProfile,
      role: "mentor",
      experience: 12,
      name: "Photo test",
      discord: "photo_" + randomUUID().slice(0, 8),
      specialty: ["Expert en photo"],
      bio: "Je peux aider les revendeurs à améliorer leurs photos.",
      goals: "Partager mes conseils sur les photos.",
      visible: false,
    },
    member,
  );
  assert.equal(profile.status, 200);
  assert.deepEqual(profile.data.profile.specialty, ["Expert en photo"]);
  const id = randomUUID();
  assert.equal((await send(id)).status, 401);
  assert.equal(
    (await send(id, member, false, "https://example.com")).status,
    403,
  );
  assert.equal((await send(id, member, true)).status, 201);
  assert.equal((await send(id, member, true)).status, 201);
  assert.equal(
    (await call("/api/suggestions", "GET", undefined, member)).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/suggestions?file=" + id, {
        headers: { cookie: member.cookie },
      })
    ).status,
    403,
  );
  const list = await call("/api/suggestions", "GET", undefined, admin);
  assert.equal(list.status, 200);
  const item = list.data.items.find((v: any) => v.id === id);
  assert.equal(item.attachment.name, "photo.png");
  assert.ok(!JSON.stringify(item).includes("local:"));
  assert.equal(
    (await query("SELECT COUNT(*) AS n FROM suggestions WHERE id=$1", [id]))[0]
      .n,
    1,
  );
  const attachment = await fetch(base + "/api/suggestions?file=" + id, {
    headers: { cookie: admin.cookie },
  });
  assert.equal(attachment.status, 200);
  assert.ok(
    attachment.headers.get("content-disposition")?.startsWith("attachment"),
  );
  assert.ok((await attachment.arrayBuffer()).byteLength > 0);
  assert.equal(
    (
      await call(
        "/api/suggestions",
        "PATCH",
        { id, status: "reviewed" },
        member,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/suggestions", "PATCH", { id, status: "reviewed" }, admin))
      .status,
    200,
  );
  for (let i = 0; i < 4; i++)
    assert.equal((await send(randomUUID(), member)).status, 201);
  assert.equal((await send(randomUUID(), member)).status, 429);
  console.log(
    "PASS : spécialité photo, suggestion avec fichier, idempotence, consultation privée administrateur, statut et limite anti-abus.",
  );
} finally {
  for (const u of users) {
    const r = await call("/api/auth/delete-user", "POST", { password }, u);
    assert.equal(r.status, 200);
    await query("DELETE FROM moderators WHERE user_id=$1", [u.id]);
    assert.equal(
      Number(
        (
          await query(
            "SELECT COUNT(*) AS n FROM suggestions WHERE user_id=$1",
            [u.id],
          )
        )[0].n,
      ),
      0,
    );
  }
  console.log("Comptes, suggestions et fichiers de test supprimés.");
}
