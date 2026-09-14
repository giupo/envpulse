import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { listAuditLog } from "@envpulse/core";
import { requireRoot } from "../lib/scopeGuard.js";

const auditEntrySchema = z.object({
  id: z.string(),
  tokenId: z.string().nullable(),
  action: z.string(),
  projectId: z.string().nullable(),
  environmentId: z.string().nullable(),
  secretKey: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.number(),
});

export async function auditRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/audit",
    {
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(1000).optional() }),
        response: { 200: z.object({ entries: z.array(auditEntrySchema) }) },
      },
    },
    async (request) => {
      requireRoot(request);
      const rows = listAuditLog(app.db, request.query.limit ?? 100);
      return {
        entries: rows.map((row) => ({
          ...row,
          metadata: row.metadata ? (JSON.parse(row.metadata) as unknown) : null,
        })),
      };
    },
  );
}
