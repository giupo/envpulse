import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./testDb.js";
import { createProject } from "../src/domain/projects.js";
import {
  createEnvironment,
  deleteEnvironment,
  getEnvironmentBySlug,
  listEnvironments,
} from "../src/domain/environments.js";
import { ConflictError, NotFoundError } from "../src/domain/errors.js";
import type { EnvPulseDb } from "../src/db/client.js";

let db: EnvPulseDb;

beforeEach(() => {
  db = createTestDb();
  createProject(db, { slug: "demo", name: "Demo" });
});

describe("environments domain", () => {
  it("creates and retrieves an environment scoped to its project", () => {
    createEnvironment(db, { projectSlug: "demo", slug: "dev", name: "Dev" });
    const env = getEnvironmentBySlug(db, "demo", "dev");
    expect(env?.name).toBe("Dev");
  });

  it("allows the same slug in different projects", () => {
    createProject(db, { slug: "other", name: "Other" });
    createEnvironment(db, { projectSlug: "demo", slug: "dev", name: "Dev" });
    createEnvironment(db, { projectSlug: "other", slug: "dev", name: "Dev" });
    expect(listEnvironments(db, "demo")).toHaveLength(1);
    expect(listEnvironments(db, "other")).toHaveLength(1);
  });

  it("rejects duplicate slugs within the same project", () => {
    createEnvironment(db, { projectSlug: "demo", slug: "dev", name: "Dev" });
    expect(() =>
      createEnvironment(db, { projectSlug: "demo", slug: "dev", name: "Dev again" }),
    ).toThrow(ConflictError);
  });

  it("throws NotFoundError for an unknown project", () => {
    expect(() =>
      createEnvironment(db, { projectSlug: "nope", slug: "dev", name: "Dev" }),
    ).toThrow(NotFoundError);
  });

  it("deletes an environment", () => {
    createEnvironment(db, { projectSlug: "demo", slug: "dev", name: "Dev" });
    deleteEnvironment(db, "demo", "dev");
    expect(getEnvironmentBySlug(db, "demo", "dev")).toBeNull();
  });
});
