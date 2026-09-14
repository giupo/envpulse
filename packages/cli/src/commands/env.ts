import type { CommandModule } from "yargs";
import { requireClient, resolveProject } from "../lib/context.js";
import { printTable, printJson } from "../lib/format.js";

export const envCommand: CommandModule = {
  command: "env <command>",
  describe: "Manage environments within a project",
  builder: (yargs) =>
    yargs
      .command<{ slug: string; name?: string; project?: string }>(
        "create <slug>",
        "Create an environment",
        (y) =>
          y
            .positional("slug", { type: "string", demandOption: true })
            .option("name", { type: "string", describe: "Defaults to the slug" })
            .option("project", { alias: "p", type: "string" }),
        async (argv) => {
          const client = await requireClient();
          const projectSlug = await resolveProject(argv);
          const env = await client.createEnvironment(projectSlug, {
            slug: argv.slug,
            name: argv.name ?? argv.slug,
          });
          console.log(`Created environment "${env.slug}" in project "${projectSlug}".`);
        },
      )
      .command<{ project?: string; json?: boolean }>(
        "list",
        "List environments in a project",
        (y) =>
          y
            .option("project", { alias: "p", type: "string" })
            .option("json", { type: "boolean", default: false }),
        async (argv) => {
          const client = await requireClient();
          const projectSlug = await resolveProject(argv);
          const { environments } = await client.listEnvironments(projectSlug);
          if (argv.json) return printJson(environments);
          printTable(environments.map((e) => ({ slug: e.slug, name: e.name })));
        },
      )
      .command<{ slug: string; project?: string; yes?: boolean }>(
        "delete <slug>",
        "Delete an environment and its secrets",
        (y) =>
          y
            .positional("slug", { type: "string", demandOption: true })
            .option("project", { alias: "p", type: "string" })
            .option("yes", { alias: "y", type: "boolean", default: false }),
        async (argv) => {
          const projectSlug = await resolveProject(argv);
          if (!argv.yes) {
            console.error(
              `This will permanently delete environment "${argv.slug}" and all its secrets. Re-run with --yes to confirm.`,
            );
            process.exitCode = 1;
            return;
          }
          const client = await requireClient();
          await client.deleteEnvironment(projectSlug, argv.slug);
          console.log(`Deleted environment "${argv.slug}".`);
        },
      )
      .demandCommand(1),
  handler: () => {},
};
