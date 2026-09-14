import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface CliConfig {
  host?: string;
  token?: string;
  defaultProject?: string;
  defaultEnvironment?: string;
}

// Computed lazily (not at module load) so tests can point HOME elsewhere.
function configDir(): string {
  return path.join(os.homedir(), ".envpulse");
}
function configFile(): string {
  return path.join(configDir(), "config.json");
}

export async function readConfig(): Promise<CliConfig> {
  try {
    const raw = await fs.readFile(configFile(), "utf8");
    return JSON.parse(raw) as CliConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

export async function writeConfig(config: CliConfig): Promise<void> {
  await fs.mkdir(configDir(), { recursive: true, mode: 0o700 });
  await fs.writeFile(configFile(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

export async function updateConfig(patch: Partial<CliConfig>): Promise<CliConfig> {
  const next = { ...(await readConfig()), ...patch };
  await writeConfig(next);
  return next;
}
