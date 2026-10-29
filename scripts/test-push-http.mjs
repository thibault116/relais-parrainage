import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Local only");
const call = async (path, method = "GET", body, cookie = "") => {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { r, data: await r.json() };
};
for (const path of ["/api/push/subscriptions", "/api/push/test"])
  assert.equal(
    (
      await call(
        path,
        path.endsWith("test") ? "POST" : "GET",
        path.endsWith("test") ? {} : undefined,
      )
    ).r.status,
    401,
  );
const stamp = crypto.randomUUID(),
  password = "Mentora-push-test-2026!";
const users = [];
try {
  for (const name of ["A", "B"]) {
    const { r } = await call("/api/auth/sign-up/email", "POST", {
      name: "Push " + name,
      email: `push-${name}-${stamp}@example.invalid`,
      password,
    });
    assert.equal(r.status, 200);
    users.push(
      r.headers
        .getSetCookie()
        .map((x) => x.split(";")[0])
        .join("; "),
    );
  }
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test-" + stamp,
    keys: {
      p256dh: Buffer.alloc(65, 1).toString("base64url"),
      auth: Buffer.alloc(16, 2).toString("base64url"),
    },
  };
  const a = await call(
    "/api/push/subscriptions",
    "POST",
    { subscription, label: "Fictif" },
    users[0],
  );
  assert.equal(a.r.status, 200);
  const id = a.data.id;
  const b = await call("/api/push/subscriptions", "GET", undefined, users[1]);
  assert.equal(b.data.devices.length, 0);
  assert(!("privateKey" in b.data));
  assert.equal(
    (
      await call(
        "/api/push/subscriptions",
        "POST",
        { subscription, label: "Fictif" },
        users[1],
      )
    ).r.status,
    409,
  );
  await call("/api/push/subscriptions", "DELETE", { id }, users[1]);
  assert.equal(
    (await call("/api/push/subscriptions", "GET", undefined, users[0])).data
      .devices.length,
    1,
  );
  assert.equal(
    (await call("/api/push/test", "POST", { id }, users[1])).r.status,
    429,
  );
  assert.equal(
    (
      await call(
        "/api/push/subscriptions",
        "POST",
        {
          subscription: {
            ...subscription,
            endpoint: "https://localhost/private",
          },
          label: "Fictif",
        },
        users[0],
      )
    ).r.status,
    400,
  );
  await call("/api/push/subscriptions", "DELETE", { all: true }, users[0]);
  assert.equal(
    (await call("/api/push/subscriptions", "GET", undefined, users[0])).data
      .devices.length,
    0,
  );
  console.log(
    "Push HTTP: authentication, private key exclusion, endpoint owner isolation, deletion, foreign-device test rejection and invalid endpoint rejection passed. No push sent.",
  );
} finally {
  for (const cookie of users)
    await call("/api/auth/delete-user", "POST", { password }, cookie);
}
