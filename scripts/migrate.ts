import { getMigrations } from "better-auth/db/migration";
import { getAuth } from "../lib/auth";
import { migrateProfiles } from "../lib/db";
await (await getMigrations(getAuth().options)).runMigrations();
await migrateProfiles();
console.log("Base Relais initialisée.");
process.exit(0);
