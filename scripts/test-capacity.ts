import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query, acceptAccompaniment } from "../lib/db";
const mentor = randomUUID(),
  one = randomUUID(),
  two = randomUUID();
try {
  await query(
    "INSERT INTO profiles (id,user_id,discord,role,name,details,visible,updated_at) VALUES ($1,$1,$1,'mentor','Test local capacité',$2,0,$3)",
    [mentor, JSON.stringify({ capacity: 1 }), new Date().toISOString()],
  );
  for (const id of [one, two])
    await query(
      "INSERT INTO accompaniments (id,beginner_id,mentor_id,status,created_at,objective) VALUES ($1,$1,$2,'pending',$3,'Test concurrence capacité')",
      [id, mentor, new Date().toISOString()],
    );
  const outcomes = await Promise.all([
    acceptAccompaniment(one, mentor),
    acceptAccompaniment(two, mentor),
  ]);
  assert.equal(outcomes.filter(Boolean).length, 1);
  const rows = await query(
    "SELECT id,status FROM accompaniments WHERE mentor_id=$1",
    [mentor],
  );
  const active = rows.find((r) => r.status === "active")!,
    pending = rows.find((r) => r.status === "pending")!;
  await query("UPDATE accompaniments SET status='completed' WHERE id=$1", [
    String(active.id),
  ]);
  assert.equal(await acceptAccompaniment(String(pending.id), mentor), true);
  console.log(
    "PASS : deux acceptations simultanées, une seule place occupée, place libérée à la fin.",
  );
} finally {
  await query("DELETE FROM accompaniments WHERE mentor_id=$1", [mentor]);
  await query("DELETE FROM profiles WHERE user_id=$1", [mentor]);
}
