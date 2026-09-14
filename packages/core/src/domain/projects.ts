import { eq } from "drizzle-orm";
import type { EnvPulseDb } from "../db/client.js";
import { projects } from "../db/schema.js";
import { ConflictError, NotFoundError } from "./errors.js";
import { isUniqueConstraintError } from "./sqliteErrors.js";

export interface Project {
  id: string;
  slug: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export function createProject(
  db: EnvPulseDb,
  input: { slug: string; name: string },
): Project {
  try {
    const row = db.insert(projects).values(input).returning().get();
    return row;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError(`Project with slug "${input.slug}" already exists`);
    }
    throw err;
  }
}

export function listProjects(db: EnvPulseDb): Project[] {
  return db.select().from(projects).all();
}

export function getProjectBySlug(db: EnvPulseDb, slug: string): Project | null {
  const row = db.select().from(projects).where(eq(projects.slug, slug)).get();
  return row ?? null;
}

export function requireProjectBySlug(db: EnvPulseDb, slug: string): Project {
  const project = getProjectBySlug(db, slug);
  if (!project) throw new NotFoundError(`Project "${slug}"`);
  return project;
}

export function deleteProject(db: EnvPulseDb, slug: string): void {
  const project = requireProjectBySlug(db, slug);
  db.delete(projects).where(eq(projects.id, project.id)).run();
}
