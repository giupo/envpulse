import type { EnvPulseDb } from "@envpulse/core";
import { createRootTokenIfMissing } from "@envpulse/core";

/** Generates the root token on a fresh database and prints it once. A no-op
 * if a root token already exists (idempotent across restarts). */
export function bootstrap(db: EnvPulseDb): void {
  const created = createRootTokenIfMissing(db);
  if (!created) return;

  // eslint-disable-next-line no-console
  console.log(`
================================================================
 EnvPulse first-run: root token generated.
 Save this now -- it will not be shown again:

 ${created.raw}

 Run: envpulse login --host http://localhost:8787 --token ${created.raw}
================================================================
`);
}
