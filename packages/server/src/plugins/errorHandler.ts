import fp from "fastify-plugin";
import type { FastifyError, FastifyInstance } from "fastify";
import { NotFoundError, ConflictError, DecryptionError } from "@envpulse/core";
import { ForbiddenError } from "../lib/scopeGuard.js";

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((err: FastifyError, request, reply) => {
    if (err instanceof NotFoundError) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: err.message } });
    }
    if (err instanceof ConflictError) {
      return reply.code(409).send({ error: { code: "CONFLICT", message: err.message } });
    }
    if (err instanceof ForbiddenError) {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: err.message } });
    }
    if (err instanceof DecryptionError) {
      request.log.error(err, "secret decryption failed");
      return reply
        .code(500)
        .send({ error: { code: "INTERNAL", message: "Internal server error" } });
    }
    if (err.validation) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: err.message } });
    }

    request.log.error(err);
    return reply.code(500).send({ error: { code: "INTERNAL", message: "Internal server error" } });
  });
});
