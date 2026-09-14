import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  createScopedToken,
  listTokens,
  revokeToken,
  requireProjectBySlug,
  requireEnvironmentBySlug,
} from "@envpulse/core";
import { requireRoot } from "../lib/scopeGuard.js";
import { audit } from "../lib/audit.js";
import { errorResponseSchema } from "../lib/schemas.js";

const tokenSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.enum(["root", "project", "environment"]),
  projectId: z.string().nullable(),
  environmentId: z.string().nullable(),
  createdAt: z.number(),
  lastUsedAt: z.number().nullable(),
});

export async function tokenRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/tokens",
    {
      schema: {
        body: z.object({
          name: z.string().min(1),
          scope: z.enum(["project", "environment"]),
          projectSlug: z.string(),
          envSlug: z.string().optional(),
        }),
        response: {
          201: z.object({ id: z.string(), name: z.string(), scope: z.string(), token: z.string() }),
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      requireRoot(request);
      const project = requireProjectBySlug(app.db, request.body.projectSlug);

      let environmentId: string | null = null;
      if (request.body.scope === "environment") {
        if (!request.body.envSlug) {
          return reply.code(400).send({
            error: {
              code: "VALIDATION",
              message: "envSlug is required for environment-scoped tokens",
            },
          });
        }
        const env = requireEnvironmentBySlug(app.db, request.body.projectSlug, request.body.envSlug);
        environmentId = env.id;
      }

      const created = createScopedToken(app.db, {
        name: request.body.name,
        scope: request.body.scope,
        projectId: project.id,
        environmentId,
      });
      audit(app, request, {
        action: "token.create",
        projectId: project.id,
        environmentId,
        metadata: { tokenId: created.id, name: request.body.name, scope: request.body.scope },
      });
      reply.code(201);
      return { id: created.id, name: request.body.name, scope: request.body.scope, token: created.raw };
    },
  );

  app.get(
    "/tokens",
    { schema: { response: { 200: z.object({ tokens: z.array(tokenSummarySchema) }) } } },
    async (request) => {
      requireRoot(request);
      return { tokens: listTokens(app.db) };
    },
  );

  app.delete(
    "/tokens/:id",
    { schema: { params: z.object({ id: z.string() }) } },
    async (request, reply) => {
      requireRoot(request);
      revokeToken(app.db, request.params.id);
      audit(app, request, { action: "token.revoke", metadata: { tokenId: request.params.id } });
      reply.code(204);
    },
  );

  app.get(
    "/whoami",
    {
      schema: {
        response: {
          200: z.object({
            scope: z.string(),
            projectId: z.string().nullable(),
            environmentId: z.string().nullable(),
          }),
        },
      },
    },
    async (request) => {
      const ctx = request.authContext!;
      return { scope: ctx.scope, projectId: ctx.projectId, environmentId: ctx.environmentId };
    },
  );
}
