import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./testDb.js";
import { createProject } from "../src/domain/projects.js";
import { createEnvironment } from "../src/domain/environments.js";
import {
  bulkSetSecrets,
  deleteSecret,
  getSecret,
  historySecret,
  listSecrets,
  rollbackSecret,
  setSecret,
} from "../src/domain/secrets.js";
import { NotFoundError } from "../src/domain/errors.js";
import type { EnvPulseDb } from "../src/db/client.js";
import type { MasterKeyring } from "../src/crypto/envelope.js";

let db: EnvPulseDb;
let keyring: MasterKeyring;
let environmentId: string;

beforeEach(() => {
  db = createTestDb();
  keyring = new Map([[1, randomBytes(32)]]);
  createProject(db, { slug: "demo", name: "Demo" });
  const env = createEnvironment(db, { projectSlug: "demo", slug: "dev", name: "Dev" });
  environmentId = env.id;
});

describe("secrets domain", () => {
  it("sets and gets a secret", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "bar" });
    const result = getSecret(db, keyring, { environmentId, key: "FOO" });
    expect(result).toMatchObject({ key: "FOO", value: "bar", version: 1 });
  });

  it("bumps the version on every set", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "bar" });
    setSecret(db, keyring, { environmentId, key: "FOO", value: "baz" });
    const result = getSecret(db, keyring, { environmentId, key: "FOO" });
    expect(result).toMatchObject({ value: "baz", version: 2 });
  });

  it("returns null for a secret that doesn't exist", () => {
    expect(getSecret(db, keyring, { environmentId, key: "MISSING" })).toBeNull();
  });

  it("records full version history, newest first", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v1" });
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v2" });
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v3" });

    const history = historySecret(db, keyring, { environmentId, key: "FOO", reveal: true });
    expect(history.map((h) => h.version)).toEqual([3, 2, 1]);
    expect(history.map((h) => h.value)).toEqual(["v3", "v2", "v1"]);
  });

  it("omits values from history unless reveal is set", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v1" });
    const history = historySecret(db, keyring, { environmentId, key: "FOO" });
    expect(history[0]?.value).toBeUndefined();
  });

  it("rolls back to a previous version by copying its ciphertext into a new version", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v1" });
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v2" });

    const rolledBack = rollbackSecret(db, { environmentId, key: "FOO", toVersion: 1 });
    expect(rolledBack.version).toBe(3);

    const current = getSecret(db, keyring, { environmentId, key: "FOO" });
    expect(current).toMatchObject({ value: "v1", version: 3 });

    const history = historySecret(db, keyring, { environmentId, key: "FOO" });
    expect(history.map((h) => h.version)).toEqual([3, 2, 1]);
  });

  it("throws NotFoundError rolling back to a version that doesn't exist", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v1" });
    expect(() =>
      rollbackSecret(db, { environmentId, key: "FOO", toVersion: 99 }),
    ).toThrow(NotFoundError);
  });

  it("soft-deletes a secret: excluded from get/list but preserved in history", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v1" });
    deleteSecret(db, { environmentId, key: "FOO" });

    expect(getSecret(db, keyring, { environmentId, key: "FOO" })).toBeNull();
    expect(listSecrets(db, keyring, { environmentId })).toHaveLength(0);
    expect(historySecret(db, keyring, { environmentId, key: "FOO" })).toHaveLength(1);
  });

  it("throws NotFoundError deleting an already-deleted or unknown secret", () => {
    expect(() => deleteSecret(db, { environmentId, key: "MISSING" })).toThrow(
      NotFoundError,
    );
  });

  it("re-setting a deleted secret undeletes it and continues its version sequence", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v1" });
    deleteSecret(db, { environmentId, key: "FOO" });
    setSecret(db, keyring, { environmentId, key: "FOO", value: "v2" });

    const current = getSecret(db, keyring, { environmentId, key: "FOO" });
    expect(current).toMatchObject({ value: "v2", version: 2 });
  });

  it("lists secrets without values by default, with values when reveal=true", () => {
    setSecret(db, keyring, { environmentId, key: "FOO", value: "bar" });

    const withoutValues = listSecrets(db, keyring, { environmentId });
    expect(withoutValues[0]?.value).toBeUndefined();

    const withValues = listSecrets(db, keyring, { environmentId, reveal: true });
    expect(withValues[0]?.value).toBe("bar");
  });

  describe("bulkSetSecrets", () => {
    it("merge mode only sets the listed keys, leaving others untouched", () => {
      setSecret(db, keyring, { environmentId, key: "EXISTING", value: "keep-me" });

      const result = bulkSetSecrets(db, keyring, {
        environmentId,
        values: { FOO: "bar", BAZ: "qux" },
        mode: "merge",
      });

      expect(result.updated.sort()).toEqual(["BAZ", "FOO"]);
      expect(result.deleted).toEqual([]);
      const keys = listSecrets(db, keyring, { environmentId }).map((s) => s.key).sort();
      expect(keys).toEqual(["BAZ", "EXISTING", "FOO"]);
    });

    it("overwrite mode soft-deletes keys absent from the payload", () => {
      setSecret(db, keyring, { environmentId, key: "EXISTING", value: "keep-me" });

      const result = bulkSetSecrets(db, keyring, {
        environmentId,
        values: { FOO: "bar" },
        mode: "overwrite",
      });

      expect(result.updated).toEqual(["FOO"]);
      expect(result.deleted).toEqual(["EXISTING"]);
      const keys = listSecrets(db, keyring, { environmentId }).map((s) => s.key);
      expect(keys).toEqual(["FOO"]);
    });
  });
});
