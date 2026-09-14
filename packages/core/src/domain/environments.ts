import { and, eq } from "drizzle-orm";
import type { EnvPulseDb } from "../db/client.js";
import { environments } from "../db/schema.js";
import { ConflictError, NotFoundError } from "./errors.js";
import { isUniqueConstraintError } from "./sqliteErrors.js";
import { requireProjectBySlug } from "./projects.js";

export interface Environment {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export function createEnvironment(
  db: EnvPulseDb,
  input: { projectSlug: string; slug: string; name: string },
): Environment {
  const project = requireProjectBySlug(db, input.projectSlug);
  try {
    const row = db
      .insert(environments)
      .values({ projectId: project.id, slug: input.slug, name: input.name })
      .returning()
      .get();
    return row;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError(
        `Environment "${input.slug}" already exists in project "${input.projectSlug}"`,
      );
    }
    throw err;
  }
}

export function listEnvironments(
  db: EnvPulseDb,
  projectSlug: string,
): Environment[] {
  const project = requireProjectBySlug(db, projectSlug);
  return db
    .select()
    .from(environments)
    .where(eq(environments.projectId, project.id))
    .all();
}

export function getEnvironmentBySlug(
  db: EnvPulseDb,
  projectSlug: string,
  envSlug: string,
): Environment | null {
  const project = requireProjectBySlug(db, projectSlug);
  const row = db
    .select()
    .from(environments)
    .where(
      and(eq(environments.projectId, project.id), eq(environments.slug, envSlug)),
    )
    .get();
  return row ?? null;
}

export function requireEnvironmentBySlug(
  db: EnvPulseDb,
  projectSlug: string,
  envSlug: string,
): Environment {
  const env = getEnvironmentBySlug(db, projectSlug, envSlug);
  if (!env) throw new NotFoundError(`Environment "${envSlug}" in project "${projectSlug}"`);
  return env;
}

export function deleteEnvironment(
  db: EnvPulseDb,
  projectSlug: string,
  envSlug: string,
): void {
  const env = requireEnvironmentBySlug(db, projectSlug, envSlug);
  db.delete(environments).where(eq(environments.id, env.id)).run();
}
