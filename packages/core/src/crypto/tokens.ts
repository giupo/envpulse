import { randomBytes, createHash } from "node:crypto";

export type TokenScope = "root" | "project" | "environment";

export interface GeneratedToken {
  /** Raw token value — shown to the caller once, never persisted. */
  raw: string;
  /** sha256 hex digest — the only form persisted to the database. */
  hash: string;
}

const SCOPE_PREFIX: Record<TokenScope, string> = {
  root: "root",
  project: "proj",
  environment: "env",
};

export function generateToken(scope: TokenScope): GeneratedToken {
  const random = randomBytes(32).toString("base64url");
  const raw = `envp_${SCOPE_PREFIX[scope]}_${random}`;
  return { raw, hash: hashToken(raw) };
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
