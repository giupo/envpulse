import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  requireProjectBySlug,
  requireEnvironmentBySlug,
  setSecret,
  getSecret,
  listSecrets,
  deleteSecret,
  historySecret,
  rollbackSecret,
  bulkSetSecrets,
} from "@envpulse/core";
import { assertEnvironmentAccess } from "../lib/scopeGuard.js";
import { audit } from "../lib/audit.js";
import {
  envParamsSchema,
  errorResponseSchema,
  revealQuerySchema,
  secretKeyParamsSchema,
  secretSchema,
  secretVersionSchema,
} from "../lib/schemas.js";

function resolveEnv(
  app: FastifyInstance,
  request: FastifyRequest,
  projectSlug: string,
  envSlug: string,
) {
  const project = requireProjectBySlug(app.db, projectSlug);
  const env = requireEnvironmentBySlug(app.db, projectSlug, envSlug);
  assertEnvironmentAccess(request, project.id, env.id);
  return env;
}

export async function secretRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/projects/:projectSlug/environments/:envSlug/secrets",
    {
      schema: {
        params: envParamsSchema,
        querystring: revealQuerySchema,
        response: { 200: z.object({ secrets: z.array(secretSchema) }) },
      },
    },
    async (request) => {
      const env = resolveEnv(app, request, request.params.projectSlug, request.params.envSlug);
      return {
        secrets: listSecrets(app.db, app.keyring, {
          environmentId: env.id,
          reveal: request.query.reveal,
        }),
      };
    },
  );

  app.put(
    "/projects/:projectSlug/environments/:envSlug/secrets/:key",
    {
      schema: {
        params: secretKeyParamsSchema,
        body: z.object({ value: z.string() }),
        response: { 200: secretSchema },
      },
    },
    async (request) => {
      const env = resolveEnv(app, request, request.params.projectSlug, request.params.envSlug);
      const result = setSecret(app.db, app.keyring, {
        environmentId: env.id,
        key: request.params.key,
        value: request.body.value,
        createdByTokenId: request.authContext!.tokenId,
      });
      audit(app, request, {
        action: "secret.set",
        projectId: env.projectId,
        environmentId: env.id,
        secretKey: request.params.key,
        metadata: { version: result.version },
      });
      return result;
    },
  );

  app.get(
    "/projects/:projectSlug/environments/:envSlug/secrets/:key",
    {
      schema: {
        params: secretKeyParamsSchema,
        response: { 200: secretSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const env = resolveEnv(app, request, request.params.projectSlug, request.params.envSlug);
      const result = getSecret(app.db, app.keyring, {
        environmentId: env.id,
        key: request.params.key,
      });
      if (!result) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: `Secret "${request.params.key}" not found` },
        });
      }
      return result;
    },
  );

  app.delete(
    "/projects/:projectSlug/environments/:envSlug/secrets/:key",
    { schema: { params: secretKeyParamsSchema } },
    async (request, reply) => {
      const env = resolveEnv(app, request, request.params.projectSlug, request.params.envSlug);
      deleteSecret(app.db, { environmentId: env.id, key: request.params.key });
      audit(app, request, {
        action: "secret.delete",
        projectId: env.projectId,
        environmentId: env.id,
        secretKey: request.params.key,
      });
      reply.code(204);
    },
  );

  app.get(
    "/projects/:projectSlug/environments/:envSlug/secrets/:key/history",
    {
      schema: {
        params: secretKeyParamsSchema,
        querystring: revealQuerySchema,
        response: { 200: z.object({ versions: z.array(secretVersionSchema) }) },
      },
    },
    async (request) => {
      const env = resolveEnv(app, request, request.params.projectSlug, request.params.envSlug);
      return {
        versions: historySecret(app.db, app.keyring, {
          environmentId: env.id,
          key: request.params.key,
          reveal: request.query.reveal,
        }),
      };
    },
  );

  app.post(
    "/projects/:projectSlug/environments/:envSlug/secrets/:key/rollback",
    {
      schema: {
        params: secretKeyParamsSchema,
        body: z.object({ toVersion: z.number().int().positive() }),
        response: { 200: secretSchema },
      },
    },
    async (request) => {
      const env = resolveEnv(app, request, request.params.projectSlug, request.params.envSlug);
      const result = rollbackSecret(app.db, {
        environmentId: env.id,
        key: request.params.key,
        toVersion: request.body.toVersion,
        createdByTokenId: request.authContext!.tokenId,
      });
      audit(app, request, {
        action: "secret.rollback",
        projectId: env.projectId,
        environmentId: env.id,
        secretKey: request.params.key,
        metadata: { toVersion: request.body.toVersion, newVersion: result.version },
      });
      return result;
    },
  );

  app.post(
    "/projects/:projectSlug/environments/:envSlug/secrets/bulk",
    {
      schema: {
        params: envParamsSchema,
        body: z.object({
          secrets: z.record(z.string()),
          mode: z.enum(["merge", "overwrite"]),
        }),
        response: { 200: z.object({ updated: z.array(z.string()), deleted: z.array(z.string()) }) },
      },
    },
    async (request) => {
      const env = resolveEnv(app, request, request.params.projectSlug, request.params.envSlug);
      const result = bulkSetSecrets(app.db, app.keyring, {
        environmentId: env.id,
        values: request.body.secrets,
        mode: request.body.mode,
        createdByTokenId: request.authContext!.tokenId,
      });
      audit(app, request, {
        action: "secret.bulk_set",
        projectId: env.projectId,
        environmentId: env.id,
        metadata: { mode: request.body.mode, updated: result.updated, deleted: result.deleted },
      });
      return result;
    },
  );
}
