import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { EnvPulseDb } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "migrations");

export function runMigrations(db: EnvPulseDb) {
  migrate(db, { migrationsFolder });
}
