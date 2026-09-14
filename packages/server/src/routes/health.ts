import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

const VERSION = "0.1.0";

export async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/health",
    {
      schema: {
        response: { 200: z.object({ status: z.literal("ok"), version: z.string() }) },
      },
    },
    async () => ({ status: "ok" as const, version: VERSION }),
  );
}
