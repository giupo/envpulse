import { and, eq, isNull } from "drizzle-orm";
import type { EnvPulseDb } from "../db/client.js";
import { tokens } from "../db/schema.js";
import { generateToken, hashToken, type TokenScope } from "../crypto/tokens.js";
import { NotFoundError } from "./errors.js";

export interface TokenRecord {
  id: string;
  name: string;
  scope: TokenScope;
  projectId: string | null;
  environmentId: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

export interface CreatedToken {
  id: string;
  /** Raw token value — shown to the caller once, never persisted or retrievable again. */
  raw: string;
}

/** Creates the root token only if one doesn't already exist. Returns the raw
 * token (to be shown to the operator once) or null if bootstrap already happened. */
export function createRootTokenIfMissing(db: EnvPulseDb): CreatedToken | null {
  const existing = db
    .select()
    .from(tokens)
    .where(and(eq(tokens.scope, "root"), isNull(tokens.revokedAt)))
    .get();
  if (existing) return null;

  const generated = generateToken("root");
  const row = db
    .insert(tokens)
    .values({ tokenHash: generated.hash, name: "root", scope: "root" })
    .returning({ id: tokens.id })
    .get();
  return { id: row.id, raw: generated.raw };
}

export function createScopedToken(
  db: EnvPulseDb,
  input: {
    name: string;
    scope: Extract<TokenScope, "project" | "environment">;
    projectId: string;
    environmentId?: string | null;
  },
): CreatedToken {
  const generated = generateToken(input.scope);
  const row = db
    .insert(tokens)
    .values({
      tokenHash: generated.hash,
      name: input.name,
      scope: input.scope,
      projectId: input.projectId,
      environmentId: input.scope === "environment" ? (input.environmentId ?? null) : null,
    })
    .returning({ id: tokens.id })
    .get();
  return { id: row.id, raw: generated.raw };
}

/** Looks up a presented raw token, returning null if unknown or revoked.
 * Bumps last_used_at as a side effect on success. */
export function verifyToken(db: EnvPulseDb, rawToken: string): TokenRecord | null {
  const hash = hashToken(rawToken);
  const row = db.select().from(tokens).where(eq(tokens.tokenHash, hash)).get();
  if (!row || row.revokedAt !== null) return null;

  db.update(tokens).set({ lastUsedAt: Date.now() }).where(eq(tokens.id, row.id)).run();
  return row;
}

export function listTokens(db: EnvPulseDb): TokenRecord[] {
  return db.select().from(tokens).all();
}

export function revokeToken(db: EnvPulseDb, id: string): void {
  const now = Date.now();
  const result = db
    .update(tokens)
    .set({ revokedAt: now })
    .where(and(eq(tokens.id, id), isNull(tokens.revokedAt)))
    .run();
  if (result.changes === 0) throw new NotFoundError(`Token "${id}"`);
}
