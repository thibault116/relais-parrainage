import { migratePush } from "../lib/push";
import { migrateCrm } from "../lib/crm";
import { migrateTasks } from "../lib/tasks";
import { migratePlatformSettings } from "../lib/platform-settings";
import { migrateProfileTiming } from "../lib/profile-timing";
import { migrateEmail } from "../lib/email-migration";
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
await migrateTasks();
await migrateVerifications();
await migrateAdministration();
await migrateVerificationFiles();
await migrateEmail();
await migratePush();
await migrateProfileTiming();
await migratePlatformSettings();
await migrateCrm();
console.log("Base Relais initialisée.");
process.exit(0);
