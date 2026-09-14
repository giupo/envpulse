import "dotenv/config";
import { createDb, runMigrations, loadMasterKeyring } from "@envpulse/core";
import { buildApp } from "./app.js";
import { bootstrap } from "./bootstrap.js";

const dbPath = process.env.ENVPULSE_DB_PATH ?? "./envpulse.db";
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const keyring = loadMasterKeyring();
const db = createDb(dbPath);
runMigrations(db);
bootstrap(db);

const app = buildApp({ db, keyring });

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
