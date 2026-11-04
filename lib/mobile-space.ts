import { randomUUID, createHash } from "node:crypto";
import { query, inTransaction } from "./db";
import { canUseFeature } from "./beta";
export async function migrateMobileSpace() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS member_bookmarks(user_id TEXT NOT NULL,profile_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,profile_id))`,
    `CREATE TABLE IF NOT EXISTS member_notice_reads(user_id TEXT NOT NULL,notice_id TEXT NOT NULL,PRIMARY KEY(user_id,notice_id))`,
    `CREATE TABLE IF NOT EXISTS private_chats(id TEXT PRIMARY KEY,user_a TEXT NOT NULL,user_b TEXT NOT NULL,requested_by TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_a,user_b))`,
    `CREATE TABLE IF NOT EXISTS private_messages(id TEXT PRIMARY KEY,chat_id TEXT NOT NULL,author_id TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL,file_path TEXT,file_mime TEXT)`,
    `CREATE INDEX IF NOT EXISTS private_messages_chat ON private_messages(chat_id,created_at,id)`,
    `CREATE TABLE IF NOT EXISTS private_chat_preferences(user_id TEXT NOT NULL,chat_id TEXT NOT NULL,pinned INTEGER NOT NULL DEFAULT 0,read_at TEXT NOT NULL DEFAULT '',PRIMARY KEY(user_id,chat_id))`,
    `CREATE TABLE IF NOT EXISTS member_blocks(user_id TEXT NOT NULL,target_id TEXT NOT NULL,PRIMARY KEY(user_id,target_id))`,
    `CREATE TABLE IF NOT EXISTS pair_notes(id TEXT PRIMARY KEY,pair_id TEXT NOT NULL,author_id TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL)`,
  ])
    await query(sql);
}
export async function mobileMember(id: string) {
  const [p] = await query(
    `SELECT p.* FROM profiles p WHERE user_id=$1 AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id=$1)`,
    [id],
  );
  if (!p) throw Error("ACCESS");
  return p;
}
export async function privateAllowed(a: string, b: string) {
  return !(
    await query(
      `SELECT user_id FROM member_blocks WHERE (user_id=$1 AND target_id=$2) OR (user_id=$2 AND target_id=$1) UNION SELECT user_id FROM profile_blocks WHERE user_id IN ($1,$2)`,
      [a, b],
    )
  ).length;
}
const chatKey = (a: string, b: string) =>
  createHash("sha256")
    .update(JSON.stringify([a, b].sort()))
    .digest("hex");
export async function connectChat(userId: string, profileId: string) {
  await mobileMember(userId);
  const [target] = await query(
    `SELECT p.user_id FROM profiles p WHERE p.id=$1 AND (p.visible=1 OR EXISTS(SELECT 1 FROM accompaniments a WHERE a.status IN ('active','completed') AND ((a.mentor_id=$2 AND a.beginner_id=p.user_id) OR (a.beginner_id=$2 AND a.mentor_id=p.user_id))))`,
    [profileId, userId],
  );
  if (
    !target ||
    target.user_id === userId ||
    !(await privateAllowed(userId, String(target.user_id)))
  )
    throw Error("ACCESS");
  const other = String(target.user_id);
  const pairs = await query(
    `SELECT id FROM accompaniments WHERE status IN ('active','completed') AND ((mentor_id=$1 AND beginner_id=$2) OR (mentor_id=$2 AND beginner_id=$1))`,
    [userId, other],
  );
  const id = chatKey(userId, other),
    [a, b] = [userId, other].sort();
  const recent = await query(
    "SELECT COUNT(*) AS n FROM private_chats WHERE requested_by=$1 AND created_at>$2",
    [userId, new Date(Date.now() - 86400000).toISOString()],
  );
  if (Number(recent[0].n) > 20) throw Error("RATE");
  await query(
    `INSERT INTO private_chats(id,user_a,user_b,requested_by,status,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
    [
      id,
      a,
      b,
      userId,
      pairs.length ? "accepted" : "pending",
      new Date().toISOString(),
    ],
  );
  if (pairs.length)
    await query(`UPDATE private_chats SET status='accepted' WHERE id=$1`, [id]);
  return id;
}
export async function chatAccess(userId: string, id: string) {
  await mobileMember(userId);
  const [chat] = await query(
    "SELECT * FROM private_chats WHERE id=$1 AND (user_a=$2 OR user_b=$2)",
    [id, userId],
  );
  if (!chat) throw Error("ACCESS");
  const other = String(chat.user_a === userId ? chat.user_b : chat.user_a);
  return {
    ...chat,
    id: String(chat.id),
    status: String(chat.status),
    other,
    canSend:
      chat.status === "accepted" && (await privateAllowed(userId, other)),
  };
}
export async function listChats(userId: string) {
  await mobileMember(userId);
  return query(
    `SELECT c.id,c.status,c.created_at,c.requested_by,p.id AS profile_id,p.name,p.role,COALESCE(pr.pinned,0) AS pinned,
 (SELECT body FROM private_messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_body,
 (SELECT MAX(created_at) FROM private_messages m WHERE m.chat_id=c.id) AS last_at,
 (SELECT COUNT(*) FROM private_messages m WHERE m.chat_id=c.id AND m.author_id<>$1 AND m.created_at>COALESCE(pr.read_at,'')) AS unread,
 CASE WHEN EXISTS(SELECT 1 FROM accompaniments a WHERE a.status IN ('active','completed') AND ((a.mentor_id=c.user_a AND a.beginner_id=c.user_b) OR (a.mentor_id=c.user_b AND a.beginner_id=c.user_a))) THEN 1 ELSE 0 END AS is_pair,
 CASE WHEN EXISTS(SELECT 1 FROM member_blocks b WHERE b.user_id=$1 AND b.target_id=p.user_id) THEN 1 ELSE 0 END AS blocked
 FROM private_chats c JOIN profiles p ON p.user_id=CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END LEFT JOIN private_chat_preferences pr ON pr.chat_id=c.id AND pr.user_id=$1 WHERE (c.user_a=$1 OR c.user_b=$1) AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id IN(c.user_a,c.user_b)) ORDER BY COALESCE(pr.pinned,0) DESC,last_at DESC,c.created_at DESC`,
    [userId],
  );
}
export async function sendPrivate(
  userId: string,
  id: string,
  body: string,
  file?: { path: string; mime: string },
) {
  return inTransaction(async (q) => {
    await q("UPDATE profiles SET updated_at=updated_at WHERE user_id=$1", [
      userId,
    ]);
    // Serialize with contact changes and simultaneous sends using an UPDATE row lock.
    await q(
      "UPDATE private_chats SET status=status WHERE id=$1 AND (user_a=$2 OR user_b=$2)",
      [id, userId],
    );
    const [c] = await q(
      `SELECT * FROM private_chats WHERE id=$1 AND (user_a=$2 OR user_b=$2) AND status='accepted' AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE user_id IN(user_a,user_b)) AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=user_a AND b.target_id=user_b) OR (b.user_id=user_b AND b.target_id=user_a))`,
      [id, userId],
    );
    if (!c) throw Error("ACCESS");
    if (
      (
        await q(
          "SELECT id FROM private_messages WHERE author_id=$1 AND created_at>$2",
          [userId, new Date(Date.now() - 1500).toISOString()],
        )
      ).length
    )
      throw Error("RATE");
    const messageId = randomUUID(),
      now = new Date().toISOString(),
      recipient = String(c.user_a === userId ? c.user_b : c.user_a);
    await q(
      "INSERT INTO private_messages(id,chat_id,author_id,body,created_at,file_path,file_mime) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        messageId,
        id,
        userId,
        body,
        now,
        file?.path || null,
        file?.mime || null,
      ],
    );
    for (const sub of await q(
      "SELECT id FROM push_subscriptions WHERE user_id=$1",
      [recipient],
    ))
      await q(
        `INSERT INTO push_outbox(id,subscription_id,user_id,event_id,kind,url,created_at) VALUES($1,$2,$3,$4,'private_message',$5,$6) ON CONFLICT(id) DO NOTHING`,
        [
          randomUUID(),
          String(sub.id),
          recipient,
          messageId,
          `/?mobile=messages&chat=${id}#profile`,
          now,
        ],
      );
    return messageId;
  });
}
export async function mobileNotices(userId: string) {
  await mobileMember(userId);
  const kinds: Record<string, string> = {
    pending: "Nouvelle demande de binôme",
    active: "Demande acceptée",
    declined: "Demande refusée",
    cancelled: "Demande annulée",
    completed: "Accompagnement terminé",
  };
  const rows = await query(
    `SELECT e.id,e.kind,e.created_at,CASE WHEN COALESCE(a.initiator_id,a.beginner_id)=$1 THEN 1 ELSE 0 END AS sent FROM email_events e JOIN accompaniments a ON a.id=e.entity_id WHERE a.mentor_id=$1 OR a.beginner_id=$1 ORDER BY e.created_at DESC LIMIT 60`,
    [userId],
  );
  const notices = rows.map((r) => ({
    id: String(r.id),
    title:
      r.kind === "pending" && Number(r.sent)
        ? "Demande de binôme envoyée"
        : kinds[String(r.kind)] || "Ton accompagnement a évolué",
    date: String(r.created_at),
    destination: "requests",
  }));
  for (const e of await query(
    "SELECT id,kind,created_at FROM email_events WHERE entity_id=$1 AND kind IN ('approved','changes') ORDER BY created_at DESC LIMIT 15",
    [userId],
  ))
    notices.push({
      id: String(e.id),
      title:
        e.kind === "approved"
          ? "Ton compte parrain est vérifié"
          : "Ton dossier nécessite des modifications",
      date: String(e.created_at),
      destination: "settings",
    });
  const mentions = await query(
    `SELECT m.id,m.created_at FROM community_mentions n JOIN community_messages m ON m.id=n.message_id JOIN profiles p ON p.user_id=n.user_id AND p.role=m.room WHERE n.user_id=$1 ORDER BY m.created_at DESC LIMIT 30`,
    [userId],
  );
  notices.push(
    ...mentions.map((r) => ({
      id: "mention:" + r.id,
      title: "Un membre te mentionne dans la communauté",
      date: String(r.created_at),
      destination: "community",
    })),
  );
  if (await canUseFeature(userId, "privateMessaging")) {
    const chats = await listChats(userId);
    for (const c of chats) {
      if (Number(c.unread) > 0)
        notices.push({
          id: "chat:" + c.id + ":" + c.last_at,
          title: "Nouveau message privé",
          date: String(c.last_at),
          destination: "messages",
        });
      if (c.status === "pending" && c.requested_by !== userId)
        notices.push({
          id: "contact:" + c.id,
          title: "Nouvelle demande de contact",
          date: String(c.created_at),
          destination: "messages",
        });
    }
  }
  const reads = new Set(
    (
      await query(
        "SELECT notice_id FROM member_notice_reads WHERE user_id=$1",
        [userId],
      )
    ).map((r) => String(r.notice_id)),
  );
  return notices
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 80)
    .map((n) => ({ ...n, read: reads.has(n.id) }));
}

export async function deleteMobileMember(userId: string) {
  const { deleteProof } = await import("./proof-storage");
  const chats = await query(
    "SELECT id FROM private_chats WHERE user_a=$1 OR user_b=$1",
    [userId],
  );
  for (const c of chats) {
    for (const f of await query(
      "SELECT file_path FROM private_messages WHERE chat_id=$1 AND file_path IS NOT NULL",
      [String(c.id)],
    ))
      await deleteProof(String(f.file_path));
    await query("DELETE FROM private_messages WHERE chat_id=$1", [
      String(c.id),
    ]);
    await query("DELETE FROM private_chat_preferences WHERE chat_id=$1", [
      String(c.id),
    ]);
    await query("DELETE FROM private_chats WHERE id=$1", [String(c.id)]);
  }
  await query(
    "DELETE FROM member_bookmarks WHERE user_id=$1 OR profile_id IN(SELECT id FROM profiles WHERE user_id=$1)",
    [userId],
  );
  await query("DELETE FROM member_notice_reads WHERE user_id=$1", [userId]);
  await query("DELETE FROM member_blocks WHERE user_id=$1 OR target_id=$1", [
    userId,
  ]);
  await query(
    "DELETE FROM pair_notes WHERE author_id=$1 OR pair_id IN(SELECT id FROM accompaniments WHERE mentor_id=$1 OR beginner_id=$1)",
    [userId],
  );
}
