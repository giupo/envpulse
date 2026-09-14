import type { CommandModule } from "yargs";
import { promises as fs } from "node:fs";
import { requireClient, resolveProjectEnv } from "../lib/context.js";
import { parseEnvFile } from "../lib/dotenv.js";

interface Args {
  file: string;
  project?: string;
  env?: string;
  mode: "merge" | "overwrite";
  yes?: boolean;
}

export const pushCommand: CommandModule<object, Args> = {
  command: "push <file>",
  describe: "Bulk-import secrets from a .env-style file",
  builder: (yargs) =>
    yargs
      .positional("file", { type: "string", demandOption: true })
      .option("project", { alias: "p", type: "string" })
      .option("env", { alias: "e", type: "string" })
      .option("mode", {
        type: "string",
        choices: ["merge", "overwrite"] as const,
        default: "merge" as const,
        describe: "merge sets/updates listed keys only; overwrite also deletes remote keys absent from the file",
      })
      .option("yes", { alias: "y", type: "boolean", default: false }),
  handler: async (argv) => {
    const content = await fs.readFile(argv.file, "utf8");
    const values = parseEnvFile(content);

    if (argv.mode === "overwrite" && !argv.yes) {
      console.error(
        `--mode overwrite will delete any remote secrets not present in ${argv.file}. Re-run with --yes to confirm.`,
      );
      process.exitCode = 1;
      return;
    }

    const client = await requireClient();
    const { projectSlug, envSlug } = await resolveProjectEnv(argv);
    const result = await client.bulkSetSecrets(projectSlug, envSlug, values, argv.mode);

    for (const key of result.updated) console.log(`~ ${key}`);
    for (const key of result.deleted) console.log(`- ${key}`);
    console.log(`${result.updated.length} set, ${result.deleted.length} deleted.`);
  },
};
