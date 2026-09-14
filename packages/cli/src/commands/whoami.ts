import type { CommandModule } from "yargs";
import { requireClient } from "../lib/context.js";

export const whoamiCommand: CommandModule = {
  command: "whoami",
  describe: "Show the scope of the currently configured token",
  handler: async () => {
    const client = await requireClient();
    const who = await client.whoami();
    console.log(JSON.stringify(who, null, 2));
  },
};
