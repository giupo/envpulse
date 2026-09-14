import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./testDb.js";
import {
  createProject,
  deleteProject,
  getProjectBySlug,
  listProjects,
} from "../src/domain/projects.js";
import { ConflictError, NotFoundError } from "../src/domain/errors.js";
import type { EnvPulseDb } from "../src/db/client.js";

let db: EnvPulseDb;

beforeEach(() => {
  db = createTestDb();
});

describe("projects domain", () => {
  it("creates and retrieves a project by slug", () => {
    createProject(db, { slug: "demo", name: "Demo" });
    const project = getProjectBySlug(db, "demo");
    expect(project?.name).toBe("Demo");
  });

  it("lists all projects", () => {
    createProject(db, { slug: "a", name: "A" });
    createProject(db, { slug: "b", name: "B" });
    expect(listProjects(db).map((p) => p.slug).sort()).toEqual(["a", "b"]);
  });

  it("rejects duplicate slugs", () => {
    createProject(db, { slug: "demo", name: "Demo" });
    expect(() => createProject(db, { slug: "demo", name: "Again" })).toThrow(
      ConflictError,
    );
  });

  it("returns null for an unknown slug", () => {
    expect(getProjectBySlug(db, "nope")).toBeNull();
  });

  it("deletes a project", () => {
    createProject(db, { slug: "demo", name: "Demo" });
    deleteProject(db, "demo");
    expect(getProjectBySlug(db, "demo")).toBeNull();
  });

  it("throws NotFoundError deleting an unknown project", () => {
    expect(() => deleteProject(db, "nope")).toThrow(NotFoundError);
  });
});
