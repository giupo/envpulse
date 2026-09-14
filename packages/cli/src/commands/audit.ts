import type { CommandModule } from "yargs";
import { requireClient } from "../lib/context.js";
import { printTable, printJson } from "../lib/format.js";

interface Args {
  limit?: number;
  json?: boolean;
}

export const auditCommand: CommandModule<object, Args> = {
  command: "audit",
  describe: "Show recent audit log entries (requires a root token)",
  builder: (yargs) =>
    yargs
      .option("limit", { type: "number", default: 100 })
      .option("json", { type: "boolean", default: false }),
  handler: async (argv) => {
    const client = await requireClient();
    const { entries } = await client.listAudit(argv.limit);
    if (argv.json) return printJson(entries);
    printTable(
      entries.map((e) => ({
        action: e.action,
        secretKey: e.secretKey ?? "",
        createdAt: new Date(e.createdAt).toISOString(),
      })),
    );
  },
};
