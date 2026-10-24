import { getMigrations } from "better-auth/db/migration";
import { getAuth } from "../lib/auth";
import {
  migrateProfiles,
  migrateAccompaniments,
  migrateVerifications,
  migrateAdministration,
} from "../lib/db";
await (await getMigrations(getAuth().options)).runMigrations();
await migrateProfiles();
await migrateAccompaniments();
await migrateVerifications();
await migrateAdministration();
console.log("Base Relais initialisée.");
process.exit(0);
