import { query } from "./db";
export async function migrateTasks() {
  await query(
    "CREATE TABLE IF NOT EXISTS mentorship_tasks(id TEXT PRIMARY KEY,accompaniment_id TEXT NOT NULL REFERENCES accompaniments(id) ON DELETE CASCADE,body TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
  );
  await query(
    "CREATE INDEX IF NOT EXISTS mentorship_tasks_pair ON mentorship_tasks(accompaniment_id,created_at)",
  );
}
export async function taskLists(userId: string) {
  const pairs = await query(
    `SELECT a.id,a.status,CASE WHEN a.mentor_id=$1 THEN 'mentor' ELSE 'beginner' END AS side,
 CASE WHEN a.mentor_id=$1 THEN COALESCE(b.name,'Ancien membre') ELSE COALESCE(m.name,'Ancien membre') END AS partner_name,
 CASE WHEN EXISTS(SELECT 1 FROM profile_blocks pb WHERE pb.user_id IN(a.mentor_id,a.beginner_id)) THEN 1 ELSE 0 END AS blocked
 FROM accompaniments a LEFT JOIN profiles m ON m.user_id=a.mentor_id LEFT JOIN profiles b ON b.user_id=a.beginner_id
 WHERE (a.mentor_id=$1 OR a.beginner_id=$1) AND a.status IN ('active','completed') ORDER BY a.status,a.created_at DESC`,
    [userId],
  );
  const tasks = await query(
    `SELECT t.* FROM mentorship_tasks t JOIN accompaniments a ON a.id=t.accompaniment_id
 WHERE (a.mentor_id=$1 OR a.beginner_id=$1) AND a.status IN ('active','completed') ORDER BY t.created_at,t.id`,
    [userId],
  );
  return pairs.map((p) => {
    const list = tasks
      .filter((t) => t.accompaniment_id === p.id)
      .map((t) => ({ ...t, done: !!Number(t.done) }));
    const completed = list.filter((t) => t.done).length;
    return {
      id: String(p.id),
      status: String(p.status),
      side: String(p.side),
      partner_name: String(p.partner_name),
      blocked: Number(p.blocked),
      tasks: list,
      completed,
      total: list.length,
      progress: list.length ? Math.round((completed / list.length) * 100) : 0,
    };
  });
}
// Permissions are part of each write so an ended binôme cannot still be edited.
const allowed = (role: "mentor" | "beginner") =>
  `EXISTS(SELECT 1 FROM accompaniments a WHERE a.id=mentorship_tasks.accompaniment_id AND a.status='active' AND a.${role}_id=$2 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id IN(a.mentor_id,a.beginner_id)))`;
export async function addTask(userId: string, pairId: string, body: string) {
  return query(
    `INSERT INTO mentorship_tasks(id,accompaniment_id,body,created_at,updated_at)
 SELECT $1,a.id,$3,$4,$4 FROM accompaniments a WHERE a.id=$2 AND a.mentor_id=$5 AND a.status='active'
 AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id IN(a.mentor_id,a.beginner_id)) RETURNING id`,
    [crypto.randomUUID(), pairId, body, new Date().toISOString(), userId],
  );
}
export async function changeTask(
  userId: string,
  id: string,
  body: string | undefined,
  done: boolean | undefined,
) {
  if (body !== undefined)
    return query(
      `UPDATE mentorship_tasks SET body=$3,updated_at=$4 WHERE id=$1 AND ${allowed("mentor")} RETURNING id`,
      [id, userId, body, new Date().toISOString()],
    );
  return query(
    `UPDATE mentorship_tasks SET done=$3,updated_at=$4 WHERE id=$1 AND ${allowed("beginner")} RETURNING id`,
    [id, userId, done ? 1 : 0, new Date().toISOString()],
  );
}
export async function removeTask(userId: string, id: string) {
  return query(
    `DELETE FROM mentorship_tasks WHERE id=$1 AND ${allowed("mentor")} RETURNING id`,
    [id, userId],
  );
}
