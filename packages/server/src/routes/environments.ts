import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  createEnvironment,
  listEnvironments,
  requireProjectBySlug,
  requireEnvironmentBySlug,
  deleteEnvironment,
} from "@envpulse/core";
import { assertProjectAccess, assertEnvironmentAccess } from "../lib/scopeGuard.js";
import { audit } from "../lib/audit.js";
import { envParamsSchema, environmentSchema, projectParamsSchema } from "../lib/schemas.js";

export async function environmentRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/projects/:projectSlug/environments",
    {
      schema: {
        params: projectParamsSchema,
        body: z.object({ slug: z.string().min(1), name: z.string().min(1) }),
        response: { 201: environmentSchema },
      },
    },
    async (request, reply) => {
      const project = requireProjectBySlug(app.db, request.params.projectSlug);
      assertProjectAccess(request, project.id);
      const env = createEnvironment(app.db, {
        projectSlug: request.params.projectSlug,
        slug: request.body.slug,
        name: request.body.name,
      });
      audit(app, request, {
        action: "environment.create",
        projectId: project.id,
        environmentId: env.id,
      });
      reply.code(201);
      return env;
    },
  );

  app.get(
    "/projects/:projectSlug/environments",
    {
      schema: {
        params: projectParamsSchema,
        response: { 200: z.object({ environments: z.array(environmentSchema) }) },
      },
    },
    async (request) => {
      const project = requireProjectBySlug(app.db, request.params.projectSlug);
      assertProjectAccess(request, project.id);
      return { environments: listEnvironments(app.db, request.params.projectSlug) };
    },
  );

  app.delete(
    "/projects/:projectSlug/environments/:envSlug",
    { schema: { params: envParamsSchema } },
    async (request, reply) => {
      const project = requireProjectBySlug(app.db, request.params.projectSlug);
      const env = requireEnvironmentBySlug(
        app.db,
        request.params.projectSlug,
        request.params.envSlug,
      );
      assertEnvironmentAccess(request, project.id, env.id);
      // Recorded before deleting, see the project.delete route for why.
      audit(app, request, {
        action: "environment.delete",
        projectId: project.id,
        environmentId: env.id,
        metadata: { slug: env.slug },
      });
      deleteEnvironment(app.db, request.params.projectSlug, request.params.envSlug);
      reply.code(204);
    },
  );
}
