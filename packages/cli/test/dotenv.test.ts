import { describe, expect, it } from "vitest";
import { parseEnvFile, serializeEnvFile } from "../src/lib/dotenv.js";

describe("parseEnvFile", () => {
  it("parses simple KEY=value pairs", () => {
    expect(parseEnvFile("FOO=bar\nBAZ=qux\n")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores comments and blank lines", () => {
    expect(parseEnvFile("# comment\nFOO=bar\n\nBAZ=qux\n")).toEqual({
      FOO: "bar",
      BAZ: "qux",
    });
  });

  it("unquotes quoted values", () => {
    expect(parseEnvFile('FOO="hello world"\n')).toEqual({ FOO: "hello world" });
  });

  it("handles empty values", () => {
    expect(parseEnvFile("FOO=\n")).toEqual({ FOO: "" });
  });
});

describe("serializeEnvFile", () => {
  it("writes simple values without quotes", () => {
    expect(serializeEnvFile({ FOO: "bar" })).toBe("FOO=bar\n");
  });

  it("quotes values containing whitespace or embedded quote characters verbatim", () => {
    const out = serializeEnvFile({ FOO: "hello world", BAR: 'a"b' });
    expect(out).toContain('FOO="hello world"');
    expect(out).toContain('BAR="a"b"');
  });

  it("converts a real newline to a literal \\n escape inside quotes", () => {
    expect(serializeEnvFile({ FOO: "line1\nline2" })).toBe('FOO="line1\\nline2"\n');
  });

  it("quotes empty values", () => {
    expect(serializeEnvFile({ FOO: "" })).toBe('FOO=""\n');
  });

  it("round-trips through parse", () => {
    const original = { FOO: "hello world", BAR: "simple", BAZ: 'with "quotes"' };
    const roundTripped = parseEnvFile(serializeEnvFile(original));
    expect(roundTripped).toEqual(original);
  });

  it("returns an empty string for no values", () => {
    expect(serializeEnvFile({})).toBe("");
  });
});
