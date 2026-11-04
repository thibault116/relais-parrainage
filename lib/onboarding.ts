import { query } from "./db";
import {
  onboardingSchema,
  completedMonths,
  experienceMonths,
  proofIds,
  type Onboarding,
} from "./onboarding-schema";
export const REQUIRED_ONBOARDING_REVISION = "2026-11-04-refresh";
export async function needsOnboarding(userId: string) {
  const rows = await query(
    "SELECT user_id FROM onboarding_confirmations WHERE user_id=$1 AND revision=$2",
    [userId, REQUIRED_ONBOARDING_REVISION],
  );
  return rows.length === 0;
}
export async function migrateOnboarding() {
  await query(
    "CREATE TABLE IF NOT EXISTS mentor_portfolios(user_id TEXT PRIMARY KEY,bio TEXT NOT NULL DEFAULT '')",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS mentor_portfolio_images(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,stored_path TEXT NOT NULL,mime TEXT NOT NULL,created_at TEXT NOT NULL)",
  );
  await query(
    "CREATE INDEX IF NOT EXISTS mentor_portfolio_owner ON mentor_portfolio_images(user_id)",
  );
  await query(
    "CREATE TABLE IF NOT EXISTS onboarding_confirmations(user_id TEXT PRIMARY KEY,revision TEXT NOT NULL,confirmed_at TEXT NOT NULL)",
  );
  await query(
    `CREATE TABLE IF NOT EXISTS onboarding_answers(user_id TEXT PRIMARY KEY,answers TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  );
}
export async function readOnboarding(
  userId: string,
): Promise<Onboarding | null> {
  const [row] = await query(
    "SELECT answers FROM onboarding_answers WHERE user_id=$1",
    [userId],
  );
  return row ? JSON.parse(String(row.answers)) : null;
}
export async function validateOnboarding(
  userId: string,
  input: unknown,
  role: string,
) {
  const cleaned =
    input &&
    typeof input === "object" &&
    "role" in input &&
    input.role === "mentor"
      ? { ...input, months: [] }
      : input;
  const parsed = onboardingSchema.safeParse(cleaned);
  if (!parsed.success) throw Error(parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.role !== role)
    throw Error("Le questionnaire doit correspondre au type de profil.");
  if (d.role === "mentor") {
    if (experienceMonths(d.started) < 6)
      throw Error(
        "Il faut au moins six mois complets d’achat-revente pour devenir parrain.",
      );
    for (const id of proofIds(d)) {
      const [f] = await query(
        "SELECT mime FROM verification_files WHERE id=$1 AND user_id=$2",
        [id, userId],
      );
      if (!f || !String(f.mime).startsWith("image/"))
        throw Error(
          "Une capture est introuvable, n’est pas une image ou ne t’appartient pas.",
        );
    }
  }
  return d;
}
export async function saveOnboarding(
  userId: string,
  d: Onboarding,
  q: typeof query = query,
) {
  const now = new Date().toISOString();
  await q(
    "INSERT INTO onboarding_confirmations(user_id,revision,confirmed_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,confirmed_at=excluded.confirmed_at",
    [userId, REQUIRED_ONBOARDING_REVISION, now],
  );
  await q(
    `INSERT INTO onboarding_answers(user_id,answers,created_at,updated_at) VALUES($1,$2,$3,$3) ON CONFLICT(user_id) DO UPDATE SET answers=excluded.answers,updated_at=excluded.updated_at`,
    [userId, JSON.stringify(d), now],
  );
}
