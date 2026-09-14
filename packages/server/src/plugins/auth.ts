import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { verifyToken } from "@envpulse/core";

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/v1/health")) return;

    const header = request.headers.authorization;
    const rawToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!rawToken) {
      return reply
        .code(401)
        .send({ error: { code: "UNAUTHORIZED", message: "Missing bearer token" } });
    }

    const record = verifyToken(app.db, rawToken);
    if (!record) {
      return reply
        .code(401)
        .send({ error: { code: "UNAUTHORIZED", message: "Invalid or revoked token" } });
    }

    request.authContext = {
      tokenId: record.id,
      scope: record.scope,
      projectId: record.projectId,
      environmentId: record.environmentId,
    };
  });
});
