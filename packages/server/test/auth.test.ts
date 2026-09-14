import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, authHeader } from "./testApp.js";

let app: FastifyInstance;
let rootToken: string;

beforeEach(async () => {
  ({ app, rootToken } = createTestApp());
  await app.inject({
    method: "POST",
    url: "/api/v1/projects",
    headers: authHeader(rootToken),
    payload: { slug: "demo", name: "Demo" },
  });
  await app.inject({
    method: "POST",
    url: "/api/v1/projects/demo/environments",
    headers: authHeader(rootToken),
    payload: { slug: "dev", name: "Dev" },
  });
  await app.inject({
    method: "POST",
    url: "/api/v1/projects/demo/environments",
    headers: authHeader(rootToken),
    payload: { slug: "prod", name: "Prod" },
  });
});

async function createToken(
  app: FastifyInstance,
  rootToken: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/tokens",
    headers: authHeader(rootToken),
    payload: body,
  });
  return res.json().token;
}

describe("auth", () => {
  it("rejects requests with no token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/projects" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an unknown/garbage token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: authHeader("envp_root_not-a-real-token"),
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a revoked token", async () => {
    const scoped = await createToken(app, rootToken, {
      name: "ci",
      scope: "project",
      projectSlug: "demo",
    });
    const tokensList = await app.inject({
      method: "GET",
      url: "/api/v1/tokens",
      headers: authHeader(rootToken),
    });
    const record = tokensList.json().tokens.find((t: { scope: string }) => t.scope === "project");

    const revoke = await app.inject({
      method: "DELETE",
      url: `/api/v1/tokens/${record.id}`,
      headers: authHeader(rootToken),
    });
    expect(revoke.statusCode).toBe(204);

    const afterRevoke = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo/environments/dev/secrets",
      headers: authHeader(scoped),
    });
    expect(afterRevoke.statusCode).toBe(401);
  });

  it("allows a root token full access", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo/environments/dev/secrets",
      headers: authHeader(rootToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a non-root token creating a project", async () => {
    const scoped = await createToken(app, rootToken, {
      name: "ci",
      scope: "project",
      projectSlug: "demo",
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeader(scoped),
      payload: { slug: "other", name: "Other" },
    });
    expect(res.statusCode).toBe(403);
  });

  describe("project-scoped token", () => {
    it("allows access to any environment within its own project", async () => {
      const scoped = await createToken(app, rootToken, {
        name: "ci",
        scope: "project",
        projectSlug: "demo",
      });
      const dev = await app.inject({
        method: "GET",
        url: "/api/v1/projects/demo/environments/dev/secrets",
        headers: authHeader(scoped),
      });
      const prod = await app.inject({
        method: "GET",
        url: "/api/v1/projects/demo/environments/prod/secrets",
        headers: authHeader(scoped),
      });
      expect(dev.statusCode).toBe(200);
      expect(prod.statusCode).toBe(200);
    });

    it("rejects access to a different project", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers: authHeader(rootToken),
        payload: { slug: "other", name: "Other" },
      });
      await app.inject({
        method: "POST",
        url: "/api/v1/projects/other/environments",
        headers: authHeader(rootToken),
        payload: { slug: "dev", name: "Dev" },
      });

      const scoped = await createToken(app, rootToken, {
        name: "ci",
        scope: "project",
        projectSlug: "demo",
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/projects/other/environments/dev/secrets",
        headers: authHeader(scoped),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("environment-scoped token", () => {
    it("allows access only to its exact environment", async () => {
      const scoped = await createToken(app, rootToken, {
        name: "ci-dev",
        scope: "environment",
        projectSlug: "demo",
        envSlug: "dev",
      });

      const dev = await app.inject({
        method: "GET",
        url: "/api/v1/projects/demo/environments/dev/secrets",
        headers: authHeader(scoped),
      });
      expect(dev.statusCode).toBe(200);

      const prod = await app.inject({
        method: "GET",
        url: "/api/v1/projects/demo/environments/prod/secrets",
        headers: authHeader(scoped),
      });
      expect(prod.statusCode).toBe(403);
    });
  });
});
