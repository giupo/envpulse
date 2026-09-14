import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  createProject,
  listProjects,
  requireProjectBySlug,
  deleteProject,
  listEnvironments,
} from "@envpulse/core";
import { requireRoot, assertProjectAccess } from "../lib/scopeGuard.js";
import { audit } from "../lib/audit.js";
import { projectParamsSchema, projectSchema } from "../lib/schemas.js";

export async function projectRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/projects",
    {
      schema: {
        body: z.object({ slug: z.string().min(1), name: z.string().min(1) }),
        response: { 201: projectSchema },
      },
    },
    async (request, reply) => {
      requireRoot(request);
      const project = createProject(app.db, request.body);
      audit(app, request, { action: "project.create", projectId: project.id });
      reply.code(201);
      return project;
    },
  );

  app.get(
    "/projects",
    { schema: { response: { 200: z.object({ projects: z.array(projectSchema) }) } } },
    async (request) => {
      requireRoot(request);
      return { projects: listProjects(app.db) };
    },
  );

  app.get(
    "/projects/:projectSlug",
    {
      schema: {
        params: projectParamsSchema,
        response: {
          200: projectSchema.extend({
            environments: z.array(z.object({ slug: z.string(), name: z.string() })),
          }),
        },
      },
    },
    async (request) => {
      const project = requireProjectBySlug(app.db, request.params.projectSlug);
      assertProjectAccess(request, project.id);
      const environments = listEnvironments(app.db, project.slug);
      return {
        ...project,
        environments: environments.map((e) => ({ slug: e.slug, name: e.name })),
      };
    },
  );

  app.delete(
    "/projects/:projectSlug",
    { schema: { params: projectParamsSchema } },
    async (request, reply) => {
      requireRoot(request);
      const project = requireProjectBySlug(app.db, request.params.projectSlug);
      // Recorded before deleting: audit_log.project_id is ON DELETE SET NULL,
      // so inserting after the cascade would fail the FK (project.id no
      // longer exists) -- the slug in metadata survives the SET NULL.
      audit(app, request, {
        action: "project.delete",
        projectId: project.id,
        metadata: { slug: project.slug },
      });
      deleteProject(app.db, request.params.projectSlug);
      reply.code(204);
    },
  );
}
