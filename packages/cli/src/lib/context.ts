import { readConfig } from "../config.js";
import { ApiClient } from "../apiClient.js";

export class CliUsageError extends Error {}

export async function requireClient(): Promise<ApiClient> {
  const config = await readConfig();
  if (!config.host || !config.token) {
    throw new CliUsageError(
      "Not logged in. Run `envpulse login --host <url> --token <token>` first.",
    );
  }
  return new ApiClient({ host: config.host, token: config.token });
}

export async function resolveProject(argv: { project?: string }): Promise<string> {
  const config = await readConfig();
  const projectSlug = argv.project ?? config.defaultProject;
  if (!projectSlug) {
    throw new CliUsageError(
      "No project specified. Pass --project <slug> or set defaultProject via `envpulse login`.",
    );
  }
  return projectSlug;
}

export async function resolveProjectEnv(
  argv: { project?: string; env?: string },
): Promise<{ projectSlug: string; envSlug: string }> {
  const config = await readConfig();
  const projectSlug = argv.project ?? config.defaultProject;
  const envSlug = argv.env ?? config.defaultEnvironment;
  if (!projectSlug) {
    throw new CliUsageError(
      "No project specified. Pass --project <slug> or set defaultProject via `envpulse login`.",
    );
  }
  if (!envSlug) {
    throw new CliUsageError("No environment specified. Pass --env <slug>.");
  }
  return { projectSlug, envSlug };
}
