import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, authHeader } from "./testApp.js";

let app: FastifyInstance;
let rootToken: string;

beforeEach(() => {
  ({ app, rootToken } = createTestApp());
});

interface AuditEntry {
  action: string;
  projectId: string | null;
  environmentId: string | null;
  secretKey: string | null;
  metadata: unknown;
}

async function getAudit(): Promise<AuditEntry[]> {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/audit",
    headers: authHeader(rootToken),
  });
  return res.json().entries;
}

describe("audit log", () => {
  it("records project, environment, and secret mutations", async () => {
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
      method: "PUT",
      url: "/api/v1/projects/demo/environments/dev/secrets/FOO",
      headers: authHeader(rootToken),
      payload: { value: "bar" },
    });

    const entries = await getAudit();
    const actions = entries.map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(["project.create", "environment.create", "secret.set"]),
    );

    const secretEntry = entries.find((e) => e.action === "secret.set")!;
    expect(secretEntry.secretKey).toBe("FOO");
    expect(JSON.stringify(secretEntry)).not.toContain("bar");
  });

  it("survives project deletion by nulling the FK columns instead of failing", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeader(rootToken),
      payload: { slug: "demo", name: "Demo" },
    });

    const del = await app.inject({
      method: "DELETE",
      url: "/api/v1/projects/demo",
      headers: authHeader(rootToken),
    });
    expect(del.statusCode).toBe(204);

    const entries = await getAudit();
    const deleteEntry = entries.find((e) => e.action === "project.delete")!;
    expect(deleteEntry).toBeDefined();
    expect(deleteEntry.projectId).toBeNull();
    expect(deleteEntry.metadata).toMatchObject({ slug: "demo" });
  });

  it("survives environment deletion the same way", async () => {
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

    const del = await app.inject({
      method: "DELETE",
      url: "/api/v1/projects/demo/environments/dev",
      headers: authHeader(rootToken),
    });
    expect(del.statusCode).toBe(204);

    const entries = await getAudit();
    const deleteEntry = entries.find((e) => e.action === "environment.delete")!;
    expect(deleteEntry.environmentId).toBeNull();
    expect(deleteEntry.metadata).toMatchObject({ slug: "dev" });
  });

  it("rejects a non-root token", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeader(rootToken),
      payload: { slug: "demo", name: "Demo" },
    });
    const scopedRes = await app.inject({
      method: "POST",
      url: "/api/v1/tokens",
      headers: authHeader(rootToken),
      payload: { name: "ci", scope: "project", projectSlug: "demo" },
    });
    const scoped = scopedRes.json().token;

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/audit",
      headers: authHeader(scoped),
    });
    expect(res.statusCode).toBe(403);
  });
});
