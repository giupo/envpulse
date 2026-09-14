import { z } from "zod";

export const projectParamsSchema = z.object({ projectSlug: z.string() });
export const envParamsSchema = projectParamsSchema.extend({ envSlug: z.string() });
export const secretKeyParamsSchema = envParamsSchema.extend({ key: z.string() });

/** `?reveal=true|false` — z.coerce.boolean() would treat "false" as truthy, so
 * this coerces the two accepted string values explicitly instead. */
export const revealQuerySchema = z.object({
  reveal: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export const projectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const environmentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  slug: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const secretSchema = z.object({
  key: z.string(),
  version: z.number(),
  updatedAt: z.number(),
  value: z.string().optional(),
});

export const secretVersionSchema = z.object({
  version: z.number(),
  createdAt: z.number(),
  createdByTokenId: z.string().nullable(),
  value: z.string().optional(),
});
