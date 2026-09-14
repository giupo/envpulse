import type { FastifyRequest } from "fastify";

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

function context(request: FastifyRequest) {
  // Populated by the auth onRequest hook for every route except /health;
  // undefined here would mean the hook didn't run, which is a bug, not a 401.
  if (!request.authContext) {
    throw new Error("assertAccess called before auth hook populated authContext");
  }
  return request.authContext;
}

export function requireRoot(request: FastifyRequest): void {
  if (context(request).scope !== "root") {
    throw new ForbiddenError("This action requires a root token");
  }
}

/** Root and project-scoped tokens pass for any environment within their project;
 * environment-scoped tokens must additionally match the exact environment. */
export function assertProjectAccess(request: FastifyRequest, projectId: string): void {
  const ctx = context(request);
  if (ctx.scope === "root") return;
  if (ctx.projectId !== projectId) {
    throw new ForbiddenError("Token is not scoped to this project");
  }
}

export function assertEnvironmentAccess(
  request: FastifyRequest,
  projectId: string,
  environmentId: string,
): void {
  const ctx = context(request);
  if (ctx.scope === "root") return;
  if (ctx.projectId !== projectId) {
    throw new ForbiddenError("Token is not scoped to this project");
  }
  if (ctx.scope === "environment" && ctx.environmentId !== environmentId) {
    throw new ForbiddenError("Token is not scoped to this environment");
  }
}
