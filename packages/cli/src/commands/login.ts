import type { CommandModule } from "yargs";
import { ApiClient } from "../apiClient.js";
import { updateConfig } from "../config.js";

interface Args {
  host: string;
  token: string;
}

export const loginCommand: CommandModule<object, Args> = {
  command: "login",
  describe: "Authenticate against an EnvPulse server and save credentials locally",
  builder: (yargs) =>
    yargs
      .option("host", {
        type: "string",
        demandOption: true,
        describe: "Server URL, e.g. http://localhost:8787",
      })
      .option("token", { type: "string", demandOption: true, describe: "API token" }),
  handler: async (argv) => {
    const client = new ApiClient({ host: argv.host, token: argv.token });
    const who = await client.whoami();
    await updateConfig({ host: argv.host, token: argv.token });
    console.log(`Logged in as a ${who.scope} token.`);
  },
};
