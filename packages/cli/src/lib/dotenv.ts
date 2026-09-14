import dotenv from "dotenv";

export function parseEnvFile(content: string): Record<string, string> {
  return dotenv.parse(content);
}

// dotenv's parser does no unescaping beyond turning a literal `\n` sequence
// back into a real newline inside a double-quoted value -- it strips exactly
// the first/last character when they match a quote and leaves everything
// between untouched (including embedded quotes of either kind). So the only
// transformation we need before wrapping in quotes is real-newline -> `\n`.
function needsQuoting(value: string): boolean {
  return value === "" || /[\s"'#=]/.test(value) || value.includes("\n");
}

export function serializeEnvFile(values: Record<string, string>): string {
  const lines = Object.entries(values).map(([key, value]) => {
    if (!needsQuoting(value)) return `${key}=${value}`;
    return `${key}="${value.replace(/\n/g, "\\n")}"`;
  });
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}
