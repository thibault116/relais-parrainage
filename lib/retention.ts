import { query } from "./db";
import type { MailData } from "./email-templates";
export const inactivityDays = [7, 14, 30, 60, 90] as const;
export const cutoffFor = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString();
export async function inactiveAccounts(days: number, page: number) {
  const cutoff = cutoffFor(days);
  const [counts, unknown, rows] = await Promise.all([
    query(
      'SELECT COUNT(*) AS n FROM "user" u JOIN member_activity a ON a.user_id=u.id WHERE a.last_active_at<=$1',
      [cutoff],
    ),
    query(
      'SELECT COUNT(*) AS n FROM "user" u WHERE NOT EXISTS(SELECT 1 FROM member_activity a WHERE a.user_id=u.id)',
    ),
    query(
      `SELECT u.id,u.name,u.email,p.role,a.last_active_at,COALESCE(ep.enabled,1) AS email_enabled,
      CASE WHEN b.user_id IS NULL THEN 0 ELSE 1 END AS blocked,
      (SELECT MAX(e.created_at) FROM email_outbox e WHERE e.user_id=u.id AND e.kind='reengagement' AND e.test=0) AS last_reminder,
      (SELECT e.status FROM email_outbox e WHERE e.user_id=u.id AND e.kind='reengagement' AND e.test=0 ORDER BY e.created_at DESC LIMIT 1) AS reminder_status
      FROM "user" u JOIN member_activity a ON a.user_id=u.id LEFT JOIN profiles p ON p.user_id=u.id
      LEFT JOIN email_preferences ep ON ep.user_id=u.id LEFT JOIN profile_blocks b ON b.user_id=u.id
      WHERE a.last_active_at<=$1 ORDER BY a.last_active_at,u.id LIMIT 30 OFFSET $2`,
      [cutoff, page * 30],
    ),
  ]);
  return {
    total: Number(counts[0].n),
    unknown: Number(unknown[0].n),
    accounts: rows,
    page,
    days,
  };
}
export async function queueReminder(
  adminId: string,
  userId: string,
  days: number,
  subject: string,
  message: string,
) {
  const now = new Date().toISOString(),
    week = new Date(Date.now() - 7 * 86400000).toISOString();
  const id = `reengagement:${userId}:${Math.floor(Date.now() / (7 * 86400000))}`;
  const payload: MailData = {
    name: "",
    reminderSubject: subject,
    reminderMessage: message,
    inactiveCutoff: cutoffFor(days),
  };
  // An atomic eligibility check and unique key prevent duplicate clicks/concurrent sends.
  const rows = await query(
    `INSERT INTO email_outbox(id,event_id,user_id,kind,payload,test,created_at)
    SELECT $1,$2,u.id,'reengagement',$3,0,$4 FROM "user" u JOIN member_activity a ON a.user_id=u.id
    WHERE u.id=$5 AND a.last_active_at<=$6
    AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE b.user_id=u.id)
    AND NOT EXISTS(SELECT 1 FROM email_preferences ep WHERE ep.user_id=u.id AND ep.enabled=0)
    AND NOT EXISTS(SELECT 1 FROM email_outbox e WHERE e.user_id=u.id AND e.kind='reengagement' AND e.test=0 AND (e.created_at>$7 OR e.status IN ('pending','sending')))
    ON CONFLICT(id) DO NOTHING RETURNING id`,
    [
      id,
      `admin-reminder:${adminId}`,
      JSON.stringify(payload),
      now,
      userId,
      payload.inactiveCutoff!,
      week,
    ],
  );
  return rows.length > 0;
}
