import { randomBytes } from "node:crypto";
import { createDb, runMigrations, createRootTokenIfMissing } from "@envpulse/core";
import type { EnvPulseDb, MasterKeyring } from "@envpulse/core";
import { buildApp } from "../src/app.js";

export function createTestApp() {
  const db: EnvPulseDb = createDb(":memory:");
  runMigrations(db);
  const keyring: MasterKeyring = new Map([[1, randomBytes(32)]]);
  const app = buildApp({ db, keyring, logger: false });
  const rootToken = createRootTokenIfMissing(db)!.raw;
  return { app, db, keyring, rootToken };
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}
