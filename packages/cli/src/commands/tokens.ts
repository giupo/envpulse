import type { CommandModule } from "yargs";
import { requireClient, resolveProject } from "../lib/context.js";
import { printTable, printJson } from "../lib/format.js";

export const tokensCommand: CommandModule = {
  command: "tokens <command>",
  describe: "Manage API tokens (requires a root token)",
  builder: (yargs) =>
    yargs
      .command<{
        name: string;
        scope: "project" | "environment";
        project?: string;
        env?: string;
      }>(
        "create",
        "Create a project- or environment-scoped token",
        (y) =>
          y
            .option("name", { type: "string", demandOption: true })
            .option("scope", {
              type: "string",
              choices: ["project", "environment"] as const,
              demandOption: true,
            })
            .option("project", { alias: "p", type: "string" })
            .option("env", { alias: "e", type: "string" }),
        async (argv) => {
          const client = await requireClient();
          const projectSlug = await resolveProject(argv);
          if (argv.scope === "environment" && !argv.env) {
            throw new Error("--env is required when --scope environment.");
          }
          const created = await client.createToken({
            name: argv.name,
            scope: argv.scope,
            projectSlug,
            envSlug: argv.env,
          });
          console.log(
            `Created token "${created.name}". Save it now, it will not be shown again:\n\n  ${created.token}\n`,
          );
        },
      )
      .command<{ json?: boolean }>(
        "list",
        "List tokens",
        (y) => y.option("json", { type: "boolean", default: false }),
        async (argv) => {
          const client = await requireClient();
          const { tokens } = await client.listTokens();
          if (argv.json) return printJson(tokens);
          printTable(tokens.map((t) => ({ id: t.id, name: t.name, scope: t.scope })));
        },
      )
      .command<{ id: string }>(
        "revoke <id>",
        "Revoke a token",
        (y) => y.positional("id", { type: "string", demandOption: true }),
        async (argv) => {
          const client = await requireClient();
          await client.revokeToken(argv.id);
          console.log(`Revoked token ${argv.id}.`);
        },
      )
      .demandCommand(1),
  handler: () => {},
};
