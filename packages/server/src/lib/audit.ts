import type { FastifyInstance, FastifyRequest } from "fastify";
import { recordAudit } from "@envpulse/core";

export function audit(
  app: FastifyInstance,
  request: FastifyRequest,
  input: {
    action: string;
    projectId?: string | null;
    environmentId?: string | null;
    secretKey?: string | null;
    metadata?: unknown;
  },
): void {
  recordAudit(app.db, {
    tokenId: request.authContext?.tokenId ?? null,
    ...input,
  });
}
