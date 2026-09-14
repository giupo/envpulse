import { desc } from "drizzle-orm";
import type { EnvPulseDb } from "../db/client.js";
import { auditLog } from "../db/schema.js";

export function recordAudit(
  db: EnvPulseDb,
  input: {
    tokenId?: string | null;
    action: string;
    projectId?: string | null;
    environmentId?: string | null;
    secretKey?: string | null;
    metadata?: unknown;
  },
): void {
  db.insert(auditLog)
    .values({
      tokenId: input.tokenId ?? null,
      action: input.action,
      projectId: input.projectId ?? null,
      environmentId: input.environmentId ?? null,
      secretKey: input.secretKey ?? null,
      metadata: input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
    })
    .run();
}

export function listAuditLog(db: EnvPulseDb, limit = 100) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit).all();
}
