import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, authHeader } from "./testApp.js";

let app: FastifyInstance;
let rootToken: string;
const bulkUrl = "/api/v1/projects/demo/environments/dev/secrets/bulk";
const secretsUrl = "/api/v1/projects/demo/environments/dev/secrets";

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
    method: "PUT",
    url: `${secretsUrl}/EXISTING`,
    headers: authHeader(rootToken),
    payload: { value: "keep-me" },
  });
});

describe("bulk push", () => {
  it("merge mode only sets listed keys, leaving others untouched", async () => {
    const res = await app.inject({
      method: "POST",
      url: bulkUrl,
      headers: authHeader(rootToken),
      payload: { secrets: { FOO: "bar" }, mode: "merge" },
    });
    expect(res.json()).toEqual({ updated: ["FOO"], deleted: [] });

    const list = await app.inject({
      method: "GET",
      url: secretsUrl,
      headers: authHeader(rootToken),
    });
    const keys = list.json().secrets.map((s: { key: string }) => s.key).sort();
    expect(keys).toEqual(["EXISTING", "FOO"]);
  });

  it("overwrite mode soft-deletes keys absent from the payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: bulkUrl,
      headers: authHeader(rootToken),
      payload: { secrets: { FOO: "bar" }, mode: "overwrite" },
    });
    expect(res.json()).toEqual({ updated: ["FOO"], deleted: ["EXISTING"] });

    const list = await app.inject({
      method: "GET",
      url: secretsUrl,
      headers: authHeader(rootToken),
    });
    expect(list.json().secrets.map((s: { key: string }) => s.key)).toEqual(["FOO"]);
  });
});
