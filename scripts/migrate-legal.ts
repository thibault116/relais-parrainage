import { migratePayoutTests } from "../lib/monetization/payout-tests";
import { migrateChangelog } from "../lib/changelog/store";
import { migrateLegal } from "../lib/legal-requests";
import { database } from "../lib/db";
import { Pool } from "pg";

try {
  await migrateLegal();
  await migrateChangelog();
  await migratePayoutTests();
  console.log("Tables de l’espace juridique privé initialisées.");
} finally {
  const connection = database();
  if (connection instanceof Pool) await connection.end();
  else connection.close();
}
