import { describe, expect, it } from "vitest";
import { createDb, runMigrations, listTokens } from "@envpulse/core";
import { bootstrap } from "../src/bootstrap.js";

describe("bootstrap", () => {
  it("creates exactly one root token, even if run twice against the same db", () => {
    const db = createDb(":memory:");
    runMigrations(db);

    bootstrap(db);
    bootstrap(db);

    const rootTokens = listTokens(db).filter((t) => t.scope === "root");
    expect(rootTokens).toHaveLength(1);
  });
});
