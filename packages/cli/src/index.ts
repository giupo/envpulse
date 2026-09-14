#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loginCommand } from "./commands/login.js";
import { whoamiCommand } from "./commands/whoami.js";
import { projectsCommand } from "./commands/projects.js";
import { envCommand } from "./commands/env.js";
import { secretsCommand } from "./commands/secrets.js";
import { runCommand } from "./commands/run.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";
import { tokensCommand } from "./commands/tokens.js";
import { auditCommand } from "./commands/audit.js";
import { ApiError } from "./apiClient.js";

await yargs(hideBin(process.argv))
  .scriptName("envpulse")
  .command(loginCommand)
  .command(whoamiCommand)
  .command(projectsCommand)
  .command(envCommand)
  .command(secretsCommand)
  .command(runCommand)
  .command(pullCommand)
  .command(pushCommand)
  .command(tokensCommand)
  .command(auditCommand)
  .demandCommand(1)
  .strict()
  .fail((msg, err) => {
    if (err instanceof ApiError) {
      console.error(`Error: ${err.message} (${err.code})`);
    } else if (err) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error(`Error: ${msg}`);
    }
    // yargs still rejects parseAsync()'s promise after fail() runs for async
    // handler errors; exit here instead of letting it surface as an
    // unhandled rejection with a raw stack trace.
    process.exit(1);
  })
  .help()
  .parseAsync();
