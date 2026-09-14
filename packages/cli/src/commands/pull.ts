import type { CommandModule } from "yargs";
import { promises as fs } from "node:fs";
import { requireClient, resolveProjectEnv } from "../lib/context.js";
import { serializeEnvFile } from "../lib/dotenv.js";

interface Args {
  project?: string;
  env?: string;
  output: string;
  force?: boolean;
}

export const pullCommand: CommandModule<object, Args> = {
  command: "pull",
  describe: "Write all secrets in an environment to a .env-style file",
  builder: (yargs) =>
    yargs
      .option("project", { alias: "p", type: "string" })
      .option("env", { alias: "e", type: "string" })
      .option("output", { alias: "o", type: "string", default: ".env" })
      .option("force", {
        type: "boolean",
        default: false,
        describe: "Overwrite the output file if it already exists",
      }),
  handler: async (argv) => {
    const client = await requireClient();
    const { projectSlug, envSlug } = await resolveProjectEnv(argv);
    const { secrets } = await client.listSecrets(projectSlug, envSlug, true);

    if (!argv.force) {
      const exists = await fs
        .access(argv.output)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        throw new Error(`${argv.output} already exists. Re-run with --force to overwrite.`);
      }
    }

    const values: Record<string, string> = {};
    for (const secret of secrets) {
      if (secret.value !== undefined) values[secret.key] = secret.value;
    }

    await fs.writeFile(argv.output, serializeEnvFile(values), { mode: 0o600 });
    console.log(`Wrote ${Object.keys(values).length} secret(s) to ${argv.output}.`);
  },
};
