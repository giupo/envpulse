import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, authHeader } from "./testApp.js";

let app: FastifyInstance;
let rootToken: string;

beforeEach(() => {
  ({ app, rootToken } = createTestApp());
});

describe("projects CRUD", () => {
  it("creates, lists, gets and deletes a project", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeader(rootToken),
      payload: { slug: "demo", name: "Demo" },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: authHeader(rootToken),
    });
    expect(list.json().projects).toHaveLength(1);

    const get = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo",
      headers: authHeader(rootToken),
    });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toMatchObject({ slug: "demo", environments: [] });

    const del = await app.inject({
      method: "DELETE",
      url: "/api/v1/projects/demo",
      headers: authHeader(rootToken),
    });
    expect(del.statusCode).toBe(204);

    const getAfterDelete = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo",
      headers: authHeader(rootToken),
    });
    expect(getAfterDelete.statusCode).toBe(404);
  });

  it("returns 409 creating a project with a duplicate slug", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeader(rootToken),
      payload: { slug: "demo", name: "Demo" },
    });
    const dup = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeader(rootToken),
      payload: { slug: "demo", name: "Again" },
    });
    expect(dup.statusCode).toBe(409);
  });

  it("returns 404 for an unknown project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/projects/nope",
      headers: authHeader(rootToken),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("environments CRUD", () => {
  beforeEach(async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeader(rootToken),
      payload: { slug: "demo", name: "Demo" },
    });
  });

  it("creates, lists and deletes an environment", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/projects/demo/environments",
      headers: authHeader(rootToken),
      payload: { slug: "dev", name: "Dev" },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo/environments",
      headers: authHeader(rootToken),
    });
    expect(list.json().environments).toHaveLength(1);

    const del = await app.inject({
      method: "DELETE",
      url: "/api/v1/projects/demo/environments/dev",
      headers: authHeader(rootToken),
    });
    expect(del.statusCode).toBe(204);
  });

  it("returns 409 for a duplicate environment slug within the same project", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/projects/demo/environments",
      headers: authHeader(rootToken),
      payload: { slug: "dev", name: "Dev" },
    });
    const dup = await app.inject({
      method: "POST",
      url: "/api/v1/projects/demo/environments",
      headers: authHeader(rootToken),
      payload: { slug: "dev", name: "Dev again" },
    });
    expect(dup.statusCode).toBe(409);
  });
});

describe("secrets lifecycle over HTTP", () => {
  const secretsUrl = "/api/v1/projects/demo/environments/dev/secrets";

  beforeEach(async () => {
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
  });

  it("sets, gets, updates, and deletes a secret", async () => {
    const set = await app.inject({
      method: "PUT",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
      payload: { value: "bar" },
    });
    expect(set.json()).toMatchObject({ key: "FOO", version: 1 });

    const get = await app.inject({
      method: "GET",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
    });
    expect(get.json()).toMatchObject({ value: "bar", version: 1 });

    const update = await app.inject({
      method: "PUT",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
      payload: { value: "baz" },
    });
    expect(update.json().version).toBe(2);

    const del = await app.inject({
      method: "DELETE",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
    });
    expect(del.statusCode).toBe(204);

    const getAfterDelete = await app.inject({
      method: "GET",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
    });
    expect(getAfterDelete.statusCode).toBe(404);
  });

  it("rolls back a secret to a previous version", async () => {
    await app.inject({
      method: "PUT",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
      payload: { value: "v1" },
    });
    await app.inject({
      method: "PUT",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
      payload: { value: "v2" },
    });

    const rollback = await app.inject({
      method: "POST",
      url: `${secretsUrl}/FOO/rollback`,
      headers: authHeader(rootToken),
      payload: { toVersion: 1 },
    });
    expect(rollback.statusCode).toBe(200);

    const get = await app.inject({
      method: "GET",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
    });
    expect(get.json()).toMatchObject({ value: "v1", version: 3 });
  });

  it("lists secrets without values by default and with values when reveal=true", async () => {
    await app.inject({
      method: "PUT",
      url: `${secretsUrl}/FOO`,
      headers: authHeader(rootToken),
      payload: { value: "bar" },
    });

    const withoutValues = await app.inject({
      method: "GET",
      url: secretsUrl,
      headers: authHeader(rootToken),
    });
    expect(withoutValues.json().secrets[0].value).toBeUndefined();

    const withValues = await app.inject({
      method: "GET",
      url: `${secretsUrl}?reveal=true`,
      headers: authHeader(rootToken),
    });
    expect(withValues.json().secrets[0].value).toBe("bar");
  });
});
