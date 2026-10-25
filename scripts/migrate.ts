import { getMigrations } from "better-auth/db/migration";
import { getAuth } from "../lib/auth";
import {
  migrateSuggestions,
  migrateFollows,
  migrateProfiles,
  migrateAccompaniments,
  migrateVerifications,
  migrateAdministration,
  migrateVerificationFiles,
} from "../lib/db";
await (await getMigrations(getAuth().options)).runMigrations();
await migrateProfiles();
await migrateFollows();
await migrateSuggestions();
await migrateAccompaniments();
await migrateVerifications();
await migrateAdministration();
await migrateVerificationFiles();
console.log("Base Relais initialisée.");
process.exit(0);
