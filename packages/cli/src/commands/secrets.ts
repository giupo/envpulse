import type { Argv, CommandModule } from "yargs";
import { requireClient, resolveProjectEnv } from "../lib/context.js";
import { printTable, printJson } from "../lib/format.js";

function withProjectEnvOptions<T>(y: Argv<T>) {
  return y
    .option("project", { alias: "p", type: "string" as const })
    .option("env", { alias: "e", type: "string" as const });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").replace(/\n$/, "");
}

export const secretsCommand: CommandModule = {
  command: "secrets <command>",
  describe: "Manage secrets within a project environment",
  builder: (yargs) =>
    yargs
      .command<{ key: string; value?: string; stdin?: boolean; project?: string; env?: string }>(
        "set <key> [value]",
        "Set a secret value (creates a new version)",
        (y) =>
          withProjectEnvOptions(y)
            .positional("key", { type: "string", demandOption: true })
            .positional("value", { type: "string" })
            .option("stdin", {
              type: "boolean",
              default: false,
              describe: "Read the value from stdin instead of the command line",
            }),
        async (argv) => {
          const value = argv.stdin ? await readStdin() : argv.value;
          if (value === undefined) {
            throw new Error("Provide a value as an argument or use --stdin.");
          }
          const client = await requireClient();
          const { projectSlug, envSlug } = await resolveProjectEnv(argv);
          const result = await client.setSecret(projectSlug, envSlug, argv.key, value);
          console.log(`Set ${argv.key} (version ${result.version}).`);
        },
      )
      .command<{ key: string; project?: string; env?: string }>(
        "get <key>",
        "Print a secret's current value",
        (y) => withProjectEnvOptions(y).positional("key", { type: "string", demandOption: true }),
        async (argv) => {
          const client = await requireClient();
          const { projectSlug, envSlug } = await resolveProjectEnv(argv);
          const secret = await client.getSecret(projectSlug, envSlug, argv.key);
          console.log(secret.value);
        },
      )
      .command<{ project?: string; env?: string; reveal?: boolean; json?: boolean }>(
        "list",
        "List secrets in an environment",
        (y) =>
          withProjectEnvOptions(y)
            .option("reveal", { type: "boolean", default: false })
            .option("json", { type: "boolean", default: false }),
        async (argv) => {
          const client = await requireClient();
          const { projectSlug, envSlug } = await resolveProjectEnv(argv);
          const { secrets } = await client.listSecrets(projectSlug, envSlug, argv.reveal);
          if (argv.json) return printJson(secrets);
          printTable(
            secrets.map((s) => ({
              key: s.key,
              version: s.version,
              ...(argv.reveal ? { value: s.value ?? "" } : {}),
            })),
          );
        },
      )
      .command<{ key: string; project?: string; env?: string; yes?: boolean }>(
        "delete <key>",
        "Delete a secret (history is preserved)",
        (y) =>
          withProjectEnvOptions(y)
            .positional("key", { type: "string", demandOption: true })
            .option("yes", { alias: "y", type: "boolean", default: false }),
        async (argv) => {
          const { projectSlug, envSlug } = await resolveProjectEnv(argv);
          if (!argv.yes) {
            console.error(`This will delete "${argv.key}". Re-run with --yes to confirm.`);
            process.exitCode = 1;
            return;
          }
          const client = await requireClient();
          await client.deleteSecret(projectSlug, envSlug, argv.key);
          console.log(`Deleted ${argv.key}.`);
        },
      )
      .command<{ key: string; project?: string; env?: string; reveal?: boolean; json?: boolean }>(
        "history <key>",
        "Show version history for a secret",
        (y) =>
          withProjectEnvOptions(y)
            .positional("key", { type: "string", demandOption: true })
            .option("reveal", { type: "boolean", default: false })
            .option("json", { type: "boolean", default: false }),
        async (argv) => {
          const client = await requireClient();
          const { projectSlug, envSlug } = await resolveProjectEnv(argv);
          const { versions } = await client.historySecret(projectSlug, envSlug, argv.key, argv.reveal);
          if (argv.json) return printJson(versions);
          printTable(
            versions.map((v) => ({
              version: v.version,
              createdAt: new Date(v.createdAt).toISOString(),
              ...(argv.reveal ? { value: v.value ?? "" } : {}),
            })),
          );
        },
      )
      .command<{ key: string; toVersion: number; project?: string; env?: string }>(
        "rollback <key> <toVersion>",
        "Roll back a secret to a previous version",
        (y) =>
          withProjectEnvOptions(y)
            .positional("key", { type: "string", demandOption: true })
            .positional("toVersion", { type: "number", demandOption: true }),
        async (argv) => {
          const client = await requireClient();
          const { projectSlug, envSlug } = await resolveProjectEnv(argv);
          const result = await client.rollbackSecret(
            projectSlug,
            envSlug,
            argv.key,
            argv.toVersion,
          );
          console.log(
            `Rolled back ${argv.key} to the value from version ${argv.toVersion} (new version ${result.version}).`,
          );
        },
      )
      .demandCommand(1),
  handler: () => {},
};
