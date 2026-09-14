import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./testDb.js";
import { createProject } from "../src/domain/projects.js";
import {
  createRootTokenIfMissing,
  createScopedToken,
  listTokens,
  revokeToken,
  verifyToken,
} from "../src/domain/tokens.js";
import { NotFoundError } from "../src/domain/errors.js";
import type { EnvPulseDb } from "../src/db/client.js";

let db: EnvPulseDb;

beforeEach(() => {
  db = createTestDb();
});

describe("tokens domain", () => {
  it("bootstraps exactly one root token, even if called twice", () => {
    const first = createRootTokenIfMissing(db);
    const second = createRootTokenIfMissing(db);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(listTokens(db).filter((t) => t.scope === "root")).toHaveLength(1);
  });

  it("verifies a valid root token and rejects an unknown one", () => {
    const { raw } = createRootTokenIfMissing(db)!;
    expect(verifyToken(db, raw)?.scope).toBe("root");
    expect(verifyToken(db, "envp_root_not-a-real-token")).toBeNull();
  });

  it("creates a project-scoped token tied to its project", () => {
    const project = createProject(db, { slug: "demo", name: "Demo" });
    const { raw } = createScopedToken(db, {
      name: "ci",
      scope: "project",
      projectId: project.id,
    });

    const record = verifyToken(db, raw);
    expect(record).toMatchObject({ scope: "project", projectId: project.id });
  });

  it("rejects a revoked token", () => {
    const { raw } = createRootTokenIfMissing(db)!;
    const [record] = listTokens(db);
    revokeToken(db, record!.id);

    expect(verifyToken(db, raw)).toBeNull();
  });

  it("throws NotFoundError revoking an unknown or already-revoked token", () => {
    expect(() => revokeToken(db, "does-not-exist")).toThrow(NotFoundError);
  });
});
