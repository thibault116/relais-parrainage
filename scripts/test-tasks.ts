import assert from "node:assert/strict";
import { query } from "../lib/db";
import {
  migrateTasks,
  taskLists,
  addTask,
  changeTask,
  removeTask,
} from "../lib/tasks";
import { GET, POST } from "../app/api/tasks/route";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local SQLite only");
await migrateTasks();
await migrateTasks();
const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
const [m, b, c, x] = ids;
const p = crypto.randomUUID(),
  other = crypto.randomUUID(),
  pending = crypto.randomUUID();
try {
  assert.equal(
    (await GET(new Request("http://localhost/api/tasks"))).status,
    401,
  );
  assert.equal(
    (
      await POST(
        new Request("http://localhost/api/tasks", {
          method: "POST",
          headers: { origin: "https://wrong.example" },
        }),
      )
    ).status,
    403,
  );
  for (const id of ids)
    await query(
      'INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$1,$2,0,$3,$3)',
      [id, `${id}@example.invalid`, Date.now()],
    );
  for (const [id, beginner, status] of [
    [p, b, "active"],
    [other, c, "active"],
    [pending, x, "pending"],
  ])
    await query(
      "INSERT INTO accompaniments(id,mentor_id,beginner_id,status,created_at) VALUES($1,$2,$3,$4,$5)",
      [id, m, beginner, status, new Date().toISOString()],
    );
  assert.equal((await addTask(b, p, "Not authorized")).length, 0);
  assert.equal((await addTask(x, p, "Not authorized")).length, 0);
  assert.equal((await addTask(m, pending, "Not yet accepted")).length, 0);
  const t = String((await addTask(m, p, "Améliorer les photos"))[0].id);
  const t2 = String((await addTask(m, p, "Revoir les prix"))[0].id);
  assert.equal((await taskLists(b)).find((l) => l.id === p)?.progress, 0);
  assert.equal((await changeTask(m, t, undefined, true)).length, 0);
  assert.equal((await changeTask(c, t, undefined, true)).length, 0);
  assert.equal((await changeTask(b, t, "Cannot edit", undefined)).length, 0);
  assert.equal((await changeTask(b, t, undefined, true)).length, 1);
  assert.equal((await taskLists(m)).find((l) => l.id === p)?.progress, 50);
  assert.equal(
    (await taskLists(c)).some((l) => l.id === p),
    false,
  );
  assert.equal((await changeTask(b, t2, undefined, true)).length, 1);
  assert.equal((await taskLists(b)).find((l) => l.id === p)?.progress, 100);
  await changeTask(b, t, undefined, false);
  assert.equal((await taskLists(b)).find((l) => l.id === p)?.progress, 50);
  assert.equal((await removeTask(b, t)).length, 0);
  assert.equal(
    (
      await changeTask(
        m,
        t,
        "Refaire les photos à la lumière naturelle",
        undefined,
      )
    ).length,
    1,
  );
  await removeTask(m, t2);
  assert.equal((await taskLists(b)).find((l) => l.id === p)?.progress, 0);
  await query("UPDATE accompaniments SET status=$1 WHERE id=$2", [
    "completed",
    p,
  ]);
  assert.equal((await changeTask(b, t, undefined, true)).length, 0);
  assert.equal((await changeTask(m, t, "Archive", undefined)).length, 0);
  assert.equal((await removeTask(m, t)).length, 0);
  assert.equal((await addTask(m, p, "Archive")).length, 0);
  assert.equal((await taskLists(b)).find((l) => l.id === p)?.tasks.length, 1);
  await query(
    "INSERT INTO profile_blocks(user_id,reason,moderator_id,created_at) VALUES($1,$2,$3,$4)",
    [c, "Test", m, new Date().toISOString()],
  );
  assert.equal((await addTask(m, other, "Blocked")).length, 0);
  console.log(
    "PASS: private per-pair lists; mentor CRUD; beginner check/uncheck; progress 0/50/100%; pending, completed and blocked pairs protected; idempotent migration.",
  );
} finally {
  for (const id of [p, other, pending]) {
    await query("DELETE FROM mentorship_tasks WHERE accompaniment_id=$1", [id]);
    await query("DELETE FROM accompaniments WHERE id=$1", [id]);
  }
  await query("DELETE FROM profile_blocks WHERE user_id=$1", [c]);
  for (const id of ids) {
    await query('DELETE FROM "user" WHERE id=$1', [id]);
    await query("DELETE FROM email_availability WHERE user_id=$1", [id]);
  }
  for (const id of [p, other, pending])
    await query("DELETE FROM email_events WHERE entity_id=$1", [id]);
}
