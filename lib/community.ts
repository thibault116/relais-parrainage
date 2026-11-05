import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import { database, query, inTransaction } from "./db";

export async function migrateCommunity() {
  await query(
    "CREATE TABLE IF NOT EXISTS community_reads(user_id TEXT NOT NULL,room TEXT NOT NULL,channel TEXT NOT NULL,read_at TEXT NOT NULL,PRIMARY KEY(user_id,room,channel))",
  );
  await query(
    `CREATE TABLE IF NOT EXISTS community_messages (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, room TEXT NOT NULL CHECK(room IN ('mentor','beginner')), body TEXT NOT NULL, created_at TEXT NOT NULL)`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS community_channels(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',position INTEGER NOT NULL DEFAULT 100)`,
  );
  for (const [id, name, description, position] of [
    ["general", "Général", "Échange librement avec la communauté", 0],
    ["questions", "Questions", "Pose tes questions, partage tes conseils", 1],
    [
      "presentations",
      "Présentations",
      "Présente-toi et découvre les membres",
      2,
    ],
  ] as const)
    await query(
      "INSERT INTO community_channels(id,name,description,position) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [id, name, description, position],
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
  for (const [name, definition] of [
    ["reply_to", "TEXT"],
    ["edited_at", "TEXT"],
    ["channel", "TEXT NOT NULL DEFAULT 'general'"],
  ]) {
    if (database() instanceof Pool)
      await query(
        `ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS ${name} ${definition}`,
      );
    else if (
      !(await query("PRAGMA table_info(community_messages)")).some(
        (c) => c.name === name,
      )
    )
      await query(
        `ALTER TABLE community_messages ADD COLUMN ${name} ${definition}`,
      );
  }
  // Preserve the former rooms' messages in General when resetting the catalogue.
  await query(
    "UPDATE community_messages SET channel='general' WHERE channel IN ('announcements','sourcing','sales','progress','life')",
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
  channel = "",
  room = "",
) {
  const own = await communityAccess(userId);
  if (!own) throw Error("ACCESS");
  const other = room && room !== own.role;
  if (room && !["mentor", "beginner"].includes(room)) throw Error("ACCESS");
  if (
    other &&
    !(await query("SELECT user_id FROM moderators WHERE user_id=$1", [userId]))
      .length
  )
    throw Error("ACCESS");
  const q: typeof query = (sql, params) =>
    query(
      other
        ? sql
            .replace(
              /JOIN profiles p ON p.role=([mr]).room/g,
              (_, alias) =>
                `JOIN profiles p ON p.user_id=$1 AND ${alias}.room='${room}'`,
            )
            .replace("c.room=p.role", `c.room='${room}'`)
        : sql,
      params,
    );
  const rows = await q(
    `SELECT m.id,m.body,m.created_at,m.edited_at,m.reply_to,a.name,a.role,a.id AS profile_id,a.visible,a.details,m.author_id FROM community_messages m JOIN profiles p ON p.role=m.room JOIN profiles a ON a.user_id=m.author_id AND a.role=m.room WHERE ${allowed} AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=a.user_id) AND ($4='' OR m.channel=$4) AND ($3=0 OR EXISTS(SELECT 1 FROM community_mentions n WHERE n.message_id=m.id AND n.user_id=p.user_id AND n.seen=0)) AND ($2='' OR EXISTS(SELECT 1 FROM community_messages c WHERE c.id=$2 AND c.room=p.role AND (m.created_at<c.created_at OR (m.created_at=c.created_at AND m.id<c.id)))) ORDER BY m.created_at DESC,m.id DESC LIMIT 51`,
    [userId, before, mentionsOnly ? 1 : 0, channel],
  );
  const messages = rows.slice(0, 50);
  const mentions = messages.length
    ? await q(
        `SELECT n.message_id,t.user_id,t.name FROM community_mentions n JOIN profiles t ON t.user_id=n.user_id JOIN community_messages m ON m.id=n.message_id JOIN profiles p ON p.role=m.room WHERE ${allowed} AND m.id IN (${messages.map((_, i) => "$" + (i + 2)).join(",")}) AND t.role=m.room AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=t.user_id)`,
        [userId, ...messages.map((m) => String(m.id))],
      )
    : [];
  const replies = messages.length
    ? await q(
        `SELECT r.id,r.body,a.name FROM community_messages r JOIN profiles p ON p.role=r.room JOIN profiles a ON a.user_id=r.author_id AND a.role=r.room WHERE ${allowed} AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=a.user_id) AND r.id IN (${messages.map((_, i) => "$" + (i + 2)).join(",")})`,
        [userId, ...messages.map((m) => String(m.reply_to || ""))],
      )
    : [];
  const result = messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    reply: m.reply_to
      ? replies.find((r) => r.id === m.reply_to) || {
          id: m.reply_to,
          body: "Message indisponible",
          name: "",
        }
      : null,
    name: m.name,
    profileId: Number(m.visible) === 1 ? m.profile_id : null,
    role: m.role,
    photo:
      Number(m.visible) === 1 && JSON.parse(String(m.details || "{}")).photo
        ? `/api/profile-photo?id=${m.profile_id}`
        : null,
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
  replyTo: string | null = null,
  channel = "general",
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
    if (
      replyTo &&
      !(
        await q(
          `SELECT m.id FROM community_messages m JOIN profiles p ON p.role=m.room JOIN profiles a ON a.user_id=m.author_id AND a.role=m.room WHERE ${allowed} AND m.id=$2 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=a.user_id)`,
          [userId, replyTo],
        )
      ).length
    )
      throw Error("REPLY");
    mentions = await resolveMentions(q, userId, body, mentions);
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
      `INSERT INTO community_messages(id,author_id,room,body,created_at,reply_to,channel) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, userId, String(p.role), body, now, replyTo, channel],
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

async function resolveMentions(
  q: typeof query,
  userId: string,
  body: string,
  explicit: string[],
) {
  const candidates = await q(
    `SELECT t.user_id,t.name FROM profiles t JOIN profiles p ON p.role=t.role WHERE ${allowed} AND t.user_id<>p.user_id AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=t.user_id)`,
    [userId],
  );
  const result = new Set(explicit);
  for (const person of candidates) {
    const name = String(person.name);
    if (
      candidates.filter(
        (p) => String(p.name).toLowerCase() === name.toLowerCase(),
      ).length !== 1
    )
      continue;
    const lower = body.toLowerCase(),
      needle = "@" + name.toLowerCase();
    let offset = lower.indexOf(needle);
    while (offset >= 0) {
      const before = lower[offset - 1],
        after = lower[offset + needle.length];
      if (
        (!before || before.trim() === "") &&
        (!after || after.trim() === "" || ".,!?;:".includes(after))
      ) {
        result.add(String(person.user_id));
        break;
      }
      offset = lower.indexOf(needle, offset + needle.length);
    }
  }
  if (result.size > 10) throw Error("MENTION");
  return [...result];
}
export async function editCommunity(userId: string, id: string, body: string) {
  return inTransaction(async (q) => {
    const rows = await q(
      `UPDATE community_messages SET body=$3,edited_at=$4 WHERE id=$2 AND author_id=$1 AND EXISTS(SELECT 1 FROM profiles p WHERE ${allowed} AND p.role=community_messages.room) RETURNING id`,
      [userId, id, body, new Date().toISOString()],
    );
    if (!rows.length) throw Error("ACCESS");
    // Existing mentions remain attached; editing text never re-sends notifications.
    return id;
  });
}

export async function communityCounts(userId: string) {
  return query(
    `SELECT c.id,COUNT(m.id) AS unread FROM community_channels c JOIN profiles p ON p.user_id=$1 LEFT JOIN community_reads r ON r.user_id=p.user_id AND r.room=p.role AND r.channel=c.id LEFT JOIN community_messages m ON m.channel=c.id AND m.room=p.role AND m.author_id<>p.user_id AND m.created_at>COALESCE(r.read_at,'') AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=m.author_id) WHERE NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=p.user_id) GROUP BY c.id`,
    [userId],
  );
}
export async function readCommunityChannel(userId: string, messageId: string) {
  const [m] = await query(
    `SELECT m.room,m.channel,m.created_at FROM community_messages m JOIN profiles p ON p.role=m.room WHERE ${allowed} AND m.id=$2`,
    [userId, messageId],
  );
  if (!m) return false;
  await query(
    "INSERT INTO community_reads(user_id,room,channel,read_at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,room,channel) DO UPDATE SET read_at=CASE WHEN excluded.read_at>community_reads.read_at THEN excluded.read_at ELSE community_reads.read_at END",
    [userId, String(m.room), String(m.channel), String(m.created_at)],
  );
  return true;
}
