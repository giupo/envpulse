import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "../src/crypto/tokens.js";

describe("token generation", () => {
  it("prefixes tokens by scope", () => {
    expect(generateToken("root").raw).toMatch(/^envp_root_/);
    expect(generateToken("project").raw).toMatch(/^envp_proj_/);
    expect(generateToken("environment").raw).toMatch(/^envp_env_/);
  });

  it("produces unique raw tokens", () => {
    const a = generateToken("root");
    const b = generateToken("root");
    expect(a.raw).not.toBe(b.raw);
  });

  it("hashes deterministically", () => {
    const { raw, hash } = generateToken("project");
    expect(hashToken(raw)).toBe(hash);
  });

  it("produces different hashes for different tokens", () => {
    const a = generateToken("project");
    const b = generateToken("project");
    expect(a.hash).not.toBe(b.hash);
  });
});
