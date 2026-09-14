import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { EnvPulseDb } from "../db/client.js";
import { secrets, secretVersions } from "../db/schema.js";
import { NotFoundError } from "./errors.js";
import {
  decryptSecretValue,
  encryptSecretValue,
  type EncryptedPayload,
  type MasterKeyring,
} from "../crypto/envelope.js";

// The callback parameter of EnvPulseDb#transaction — accepted anywhere a plain
// db handle is, so write helpers can compose inside one outer transaction
// (e.g. bulk operations) without nesting savepoints.
type DbOrTx = EnvPulseDb | Parameters<Parameters<EnvPulseDb["transaction"]>[0]>[0];

export interface SecretSummary {
  key: string;
  version: number;
  updatedAt: number;
  value?: string;
}

export interface SecretVersionSummary {
  version: number;
  createdAt: number;
  createdByTokenId: string | null;
  value?: string;
}

interface VersionRow {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

function toPayload(row: VersionRow): EncryptedPayload {
  return {
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.authTag,
    keyVersion: row.keyVersion,
  };
}

function nextVersionFor(db: DbOrTx, secretId: string): number {
  const row = db
    .select({ maxVersion: sql<number | null>`max(${secretVersions.version})` })
    .from(secretVersions)
    .where(eq(secretVersions.secretId, secretId))
    .get();
  return (row?.maxVersion ?? 0) + 1;
}

function setSecretInTx(
  db: DbOrTx,
  keyring: MasterKeyring,
  input: {
    environmentId: string;
    key: string;
    value: string;
    createdByTokenId?: string | null;
  },
): SecretSummary {
  let secretRow = db
    .select()
    .from(secrets)
    .where(
      and(eq(secrets.environmentId, input.environmentId), eq(secrets.key, input.key)),
    )
    .get();

  if (!secretRow) {
    secretRow = db
      .insert(secrets)
      .values({ environmentId: input.environmentId, key: input.key })
      .returning()
      .get();
  }

  const version = nextVersionFor(db, secretRow.id);
  const payload = encryptSecretValue(input.value, keyring);
  const versionRow = db
    .insert(secretVersions)
    .values({
      secretId: secretRow.id,
      version,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      authTag: payload.authTag,
      keyVersion: payload.keyVersion,
      createdByTokenId: input.createdByTokenId ?? null,
    })
    .returning()
    .get();

  const now = Date.now();
  db.update(secrets)
    .set({ currentVersionId: versionRow.id, updatedAt: now, deletedAt: null })
    .where(eq(secrets.id, secretRow.id))
    .run();

  return { key: input.key, version, updatedAt: now };
}

export function setSecret(
  db: EnvPulseDb,
  keyring: MasterKeyring,
  input: {
    environmentId: string;
    key: string;
    value: string;
    createdByTokenId?: string | null;
  },
): SecretSummary {
  return db.transaction((tx) => setSecretInTx(tx, keyring, input));
}

export function getSecret(
  db: EnvPulseDb,
  keyring: MasterKeyring,
  input: { environmentId: string; key: string },
): SecretSummary | null {
  const row = db
    .select({
      key: secrets.key,
      updatedAt: secrets.updatedAt,
      version: secretVersions.version,
      ciphertext: secretVersions.ciphertext,
      iv: secretVersions.iv,
      authTag: secretVersions.authTag,
      keyVersion: secretVersions.keyVersion,
    })
    .from(secrets)
    .innerJoin(secretVersions, eq(secrets.currentVersionId, secretVersions.id))
    .where(
      and(
        eq(secrets.environmentId, input.environmentId),
        eq(secrets.key, input.key),
        isNull(secrets.deletedAt),
      ),
    )
    .get();

  if (!row) return null;
  return {
    key: row.key,
    version: row.version,
    updatedAt: row.updatedAt,
    value: decryptSecretValue(toPayload(row), keyring),
  };
}

export function listSecrets(
  db: EnvPulseDb,
  keyring: MasterKeyring,
  input: { environmentId: string; reveal?: boolean },
): SecretSummary[] {
  const rows = db
    .select({
      key: secrets.key,
      updatedAt: secrets.updatedAt,
      version: secretVersions.version,
      ciphertext: secretVersions.ciphertext,
      iv: secretVersions.iv,
      authTag: secretVersions.authTag,
      keyVersion: secretVersions.keyVersion,
    })
    .from(secrets)
    .innerJoin(secretVersions, eq(secrets.currentVersionId, secretVersions.id))
    .where(and(eq(secrets.environmentId, input.environmentId), isNull(secrets.deletedAt)))
    .all();

  return rows.map((row) => ({
    key: row.key,
    version: row.version,
    updatedAt: row.updatedAt,
    ...(input.reveal ? { value: decryptSecretValue(toPayload(row), keyring) } : {}),
  }));
}

export function deleteSecret(
  db: EnvPulseDb,
  input: { environmentId: string; key: string },
): void {
  const now = Date.now();
  const result = db
    .update(secrets)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(secrets.environmentId, input.environmentId),
        eq(secrets.key, input.key),
        isNull(secrets.deletedAt),
      ),
    )
    .run();
  if (result.changes === 0) {
    throw new NotFoundError(`Secret "${input.key}"`);
  }
}

export function historySecret(
  db: EnvPulseDb,
  keyring: MasterKeyring,
  input: { environmentId: string; key: string; reveal?: boolean },
): SecretVersionSummary[] {
  const secretRow = db
    .select()
    .from(secrets)
    .where(
      and(eq(secrets.environmentId, input.environmentId), eq(secrets.key, input.key)),
    )
    .get();
  if (!secretRow) throw new NotFoundError(`Secret "${input.key}"`);

  const rows = db
    .select()
    .from(secretVersions)
    .where(eq(secretVersions.secretId, secretRow.id))
    .orderBy(desc(secretVersions.version))
    .all();

  return rows.map((row) => ({
    version: row.version,
    createdAt: row.createdAt,
    createdByTokenId: row.createdByTokenId,
    ...(input.reveal ? { value: decryptSecretValue(toPayload(row), keyring) } : {}),
  }));
}

export function rollbackSecret(
  db: EnvPulseDb,
  input: {
    environmentId: string;
    key: string;
    toVersion: number;
    createdByTokenId?: string | null;
  },
): SecretSummary {
  return db.transaction((tx) => {
    const secretRow = tx
      .select()
      .from(secrets)
      .where(
        and(eq(secrets.environmentId, input.environmentId), eq(secrets.key, input.key)),
      )
      .get();
    if (!secretRow) throw new NotFoundError(`Secret "${input.key}"`);

    const targetVersion = tx
      .select()
      .from(secretVersions)
      .where(
        and(
          eq(secretVersions.secretId, secretRow.id),
          eq(secretVersions.version, input.toVersion),
        ),
      )
      .get();
    if (!targetVersion) {
      throw new NotFoundError(`Version ${input.toVersion} of secret "${input.key}"`);
    }

    const version = nextVersionFor(tx, secretRow.id);
    const versionRow = tx
      .insert(secretVersions)
      .values({
        secretId: secretRow.id,
        version,
        ciphertext: targetVersion.ciphertext,
        iv: targetVersion.iv,
        authTag: targetVersion.authTag,
        keyVersion: targetVersion.keyVersion,
        createdByTokenId: input.createdByTokenId ?? null,
      })
      .returning()
      .get();

    const now = Date.now();
    tx.update(secrets)
      .set({ currentVersionId: versionRow.id, updatedAt: now, deletedAt: null })
      .where(eq(secrets.id, secretRow.id))
      .run();

    return { key: input.key, version, updatedAt: now };
  });
}

export function bulkSetSecrets(
  db: EnvPulseDb,
  keyring: MasterKeyring,
  input: {
    environmentId: string;
    values: Record<string, string>;
    mode: "merge" | "overwrite";
    createdByTokenId?: string | null;
  },
): { updated: string[]; deleted: string[] } {
  return db.transaction((tx) => {
    const updated: string[] = [];
    for (const [key, value] of Object.entries(input.values)) {
      setSecretInTx(tx, keyring, {
        environmentId: input.environmentId,
        key,
        value,
        createdByTokenId: input.createdByTokenId,
      });
      updated.push(key);
    }

    const deleted: string[] = [];
    if (input.mode === "overwrite") {
      const keepKeys = new Set(Object.keys(input.values));
      const existing = tx
        .select({ key: secrets.key })
        .from(secrets)
        .where(and(eq(secrets.environmentId, input.environmentId), isNull(secrets.deletedAt)))
        .all();

      const now = Date.now();
      for (const row of existing) {
        if (keepKeys.has(row.key)) continue;
        tx.update(secrets)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(eq(secrets.environmentId, input.environmentId), eq(secrets.key, row.key)))
          .run();
        deleted.push(row.key);
      }
    }

    return { updated, deleted };
  });
}
