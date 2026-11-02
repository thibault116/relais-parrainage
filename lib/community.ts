import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import { database, query } from "./db";

export async function migrateCommunity() {
  await query(
    `CREATE TABLE IF NOT EXISTS community_messages (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, room TEXT NOT NULL CHECK(room IN ('mentor','beginner')), body TEXT NOT NULL, created_at TEXT NOT NULL)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS community_room_date ON community_messages(room,created_at,id)`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS community_mentions (message_id TEXT NOT NULL,user_id TEXT NOT NULL,seen INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(message_id,user_id))`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS community_mentions_owner ON community_mentions(user_id,seen)`,
  );
}
const allowed = `p.user_id=$1 AND p.role IN ('mentor','beginner') AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id)`;
export async function communityAccess(userId: string) {
  return (
    await query(`SELECT p.role FROM profiles p WHERE ${allowed}`, [userId])
  )[0];
}
export async function communityUnread(userId: string) {
  const [row] = await query(
    `SELECT COUNT(*) AS count FROM community_mentions n JOIN community_messages m ON m.id=n.message_id JOIN profiles p ON p.role=m.room JOIN profiles a ON a.user_id=m.author_id AND a.role=m.room WHERE ${allowed} AND n.user_id=p.user_id AND n.seen=0 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=a.user_id)`,
    [userId],
  );
  return Number(row?.count || 0);
}
export async function communityMessages(
  userId: string,
  before = "",
  mentionsOnly = false,
) {
  const rows = await query(
    `SELECT m.id,m.body,m.created_at,a.name,m.author_id FROM community_messages m JOIN profiles p ON p.role=m.room JOIN profiles a ON a.user_id=m.author_id AND a.role=m.room WHERE ${allowed} AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=a.user_id) AND ($3=0 OR EXISTS(SELECT 1 FROM community_mentions n WHERE n.message_id=m.id AND n.user_id=p.user_id AND n.seen=0)) AND ($2='' OR EXISTS(SELECT 1 FROM community_messages c WHERE c.id=$2 AND c.room=p.role AND (m.created_at<c.created_at OR (m.created_at=c.created_at AND m.id<c.id)))) ORDER BY m.created_at DESC,m.id DESC LIMIT 51`,
    [userId, before, mentionsOnly ? 1 : 0],
  );
  const messages = rows.slice(0, 50);
  const mentions = messages.length
    ? await query(
        `SELECT n.message_id,t.user_id,t.name FROM community_mentions n JOIN profiles t ON t.user_id=n.user_id JOIN community_messages m ON m.id=n.message_id JOIN profiles p ON p.role=m.room WHERE ${allowed} AND m.id IN (${messages.map((_, i) => "$" + (i + 2)).join(",")}) AND t.role=m.room AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=t.user_id)`,
        [userId, ...messages.map((m) => String(m.id))],
      )
    : [];
  const result = messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.created_at,
    name: m.name,
    mine: m.author_id === userId,
    mentions: mentions
      .filter((n) => n.message_id === m.id)
      .map((n) => ({ user_id: n.user_id, name: n.name })),
  }));
  return { messages: result.reverse(), hasOlder: rows.length > 50 };
}
export async function communityMembers(userId: string, search: string) {
  return query(
    `SELECT t.user_id,t.name FROM profiles t JOIN profiles p ON t.role=p.role WHERE ${allowed} AND t.user_id<>p.user_id AND LOWER(t.name) LIKE $2 ESCAPE '!' AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=t.user_id) ORDER BY t.name,t.user_id LIMIT 20`,
    [userId, `%${search.toLowerCase().replace(/[!%_]/g, (x) => "!" + x)}%`],
  );
}
export async function communityMentionRelevant(
  messageId: string,
  userId: string,
) {
  return !!(
    await query(
      `SELECT n.message_id FROM community_mentions n JOIN community_messages m ON m.id=n.message_id JOIN profiles p ON p.role=m.room JOIN profiles a ON a.user_id=m.author_id AND a.role=m.room WHERE ${allowed} AND n.user_id=p.user_id AND m.id=$2 AND n.seen=0 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=a.user_id)`,
      [userId, messageId],
    )
  ).length;
}
export async function postCommunity(
  userId: string,
  body: string,
  mentions: string[],
) {
  const db = database();
  const execute = async (q: typeof query) => {
    const [p] = await q(
      `SELECT p.role FROM profiles p WHERE ${allowed} ${db instanceof Pool ? "FOR UPDATE" : ""}`,
      [userId],
    );
    if (!p) throw new Error("ACCESS");
    const recent = await q(
      `SELECT id FROM community_messages WHERE author_id=$1 AND created_at>$2 LIMIT 1`,
      [userId, new Date(Date.now() - 3000).toISOString()],
    );
    if (recent.length) throw new Error("RATE");
    for (const id of mentions) {
      const valid = await q(
        `SELECT t.user_id FROM profiles t JOIN profiles p ON p.role=t.role WHERE ${allowed} AND t.user_id=$2 AND t.user_id<>p.user_id AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=t.user_id)`,
        [userId, id],
      );
      if (!valid.length) throw new Error("MENTION");
    }
    const id = randomUUID(),
      now = new Date().toISOString();
    await q(
      `INSERT INTO community_messages(id,author_id,room,body,created_at) VALUES($1,$2,$3,$4,$5)`,
      [id, userId, String(p.role), body, now],
    );
    for (const recipient of mentions) {
      await q(
        `INSERT INTO community_mentions(message_id,user_id) VALUES($1,$2)`,
        [id, recipient],
      );
      const subs = await q(
        `SELECT id FROM push_subscriptions WHERE user_id=$1`,
        [recipient],
      );
      for (const sub of subs)
        await q(
          `INSERT INTO push_outbox(id,subscription_id,user_id,event_id,kind,url,created_at) VALUES($1,$2,$3,$4,'community_mention',$5,$6) ON CONFLICT(id) DO NOTHING`,
          [
            createHash("sha256")
              .update(`${id}:community:${sub.id}`)
              .digest("hex"),
            String(sub.id),
            recipient,
            id,
            `/?communityMentions=1#community`,
            now,
          ],
        );
    }
    return id;
  };
  if (db instanceof Pool) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await execute(
        async (sql, params) => (await client.query(sql, params)).rows,
      );
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = await execute(query);
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export async function readCommunity(userId: string, ids: string[]) {
  for (const id of ids)
    await query(
      `UPDATE community_mentions SET seen=1 WHERE user_id=$1 AND message_id=$2 AND EXISTS(SELECT 1 FROM community_messages m JOIN profiles p ON p.role=m.room WHERE ${allowed} AND m.id=$2)`,
      [userId, id],
    );
}
export async function deleteCommunity(userId: string, id: string) {
  const rows = await query(
    `DELETE FROM community_messages WHERE id=$2 AND author_id=$1 AND EXISTS(SELECT 1 FROM profiles p WHERE ${allowed} AND p.role=community_messages.room) RETURNING id`,
    [userId, id],
  );
  if (rows.length)
    await query("DELETE FROM community_mentions WHERE message_id=$1", [id]);
  return rows;
}
