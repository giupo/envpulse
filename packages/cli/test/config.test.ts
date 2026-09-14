import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readConfig, updateConfig, writeConfig } from "../src/config.js";

let tempHome: string;
let originalHome: string | undefined;

beforeEach(async () => {
  tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "envpulse-cli-test-"));
  originalHome = process.env.HOME;
  process.env.HOME = tempHome;
});

afterEach(async () => {
  process.env.HOME = originalHome;
  await fs.rm(tempHome, { recursive: true, force: true });
});

describe("config", () => {
  it("returns an empty object when no config file exists", async () => {
    expect(await readConfig()).toEqual({});
  });

  it("writes and reads back config", async () => {
    await writeConfig({ host: "http://localhost:8787", token: "envp_root_x" });
    expect(await readConfig()).toEqual({ host: "http://localhost:8787", token: "envp_root_x" });
  });

  it("creates the config directory with restrictive permissions", async () => {
    await writeConfig({ host: "http://localhost:8787" });
    const stat = await fs.stat(path.join(tempHome, ".envpulse"));
    expect(stat.mode & 0o777).toBe(0o700);
  });

  it("updateConfig merges into existing config", async () => {
    await updateConfig({ host: "http://localhost:8787", token: "t1" });
    await updateConfig({ defaultProject: "demo" });
    expect(await readConfig()).toEqual({
      host: "http://localhost:8787",
      token: "t1",
      defaultProject: "demo",
    });
  });
});
