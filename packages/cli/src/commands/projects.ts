import type { CommandModule } from "yargs";
import { requireClient } from "../lib/context.js";
import { printTable, printJson } from "../lib/format.js";

export const projectsCommand: CommandModule = {
  command: "projects <command>",
  describe: "Manage projects",
  builder: (yargs) =>
    yargs
      .command<{ slug: string; name?: string }>(
        "create <slug>",
        "Create a project",
        (y) =>
          y
            .positional("slug", { type: "string", demandOption: true })
            .option("name", { type: "string", describe: "Defaults to the slug" }),
        async (argv) => {
          const client = await requireClient();
          const project = await client.createProject({
            slug: argv.slug,
            name: argv.name ?? argv.slug,
          });
          console.log(`Created project "${project.slug}".`);
        },
      )
      .command<{ json?: boolean }>(
        "list",
        "List projects",
        (y) => y.option("json", { type: "boolean", default: false }),
        async (argv) => {
          const client = await requireClient();
          const { projects } = await client.listProjects();
          if (argv.json) return printJson(projects);
          printTable(projects.map((p) => ({ slug: p.slug, name: p.name })));
        },
      )
      .command<{ slug: string; yes?: boolean }>(
        "delete <slug>",
        "Delete a project and everything in it",
        (y) =>
          y
            .positional("slug", { type: "string", demandOption: true })
            .option("yes", { alias: "y", type: "boolean", default: false }),
        async (argv) => {
          if (!argv.yes) {
            console.error(
              `This will permanently delete project "${argv.slug}" and all its environments/secrets. Re-run with --yes to confirm.`,
            );
            process.exitCode = 1;
            return;
          }
          const client = await requireClient();
          await client.deleteProject(argv.slug);
          console.log(`Deleted project "${argv.slug}".`);
        },
      )
      .demandCommand(1),
  handler: () => {},
};
