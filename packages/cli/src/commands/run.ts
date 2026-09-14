import type { CommandModule } from "yargs";
import { spawn } from "node:child_process";
import { requireClient, resolveProjectEnv } from "../lib/context.js";

interface Args {
  project?: string;
  env?: string;
  "--"?: (string | number)[];
}

export const runCommand: CommandModule<object, Args> = {
  command: "run",
  describe: "Fetch secrets and run a command with them injected as environment variables",
  builder: (yargs) =>
    yargs
      .option("project", { alias: "p", type: "string" })
      .option("env", { alias: "e", type: "string" })
      .parserConfiguration({ "populate--": true })
      .example("envpulse run -- node server.js", "Run node server.js with secrets injected"),
  handler: async (argv) => {
    const args = (argv["--"] as string[] | undefined) ?? [];
    if (args.length === 0) {
      throw new Error("Provide a command to run after `--`, e.g. `envpulse run -- node server.js`.");
    }

    const client = await requireClient();
    const { projectSlug, envSlug } = await resolveProjectEnv(argv);
    const { secrets } = await client.listSecrets(projectSlug, envSlug, true);

    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    for (const secret of secrets) {
      if (secret.value !== undefined) childEnv[secret.key] = secret.value;
    }

    const [command, ...rest] = args;
    const child = spawn(command!, rest, { env: childEnv, stdio: "inherit" });

    const forwardSignal = (signal: NodeJS.Signals) => child.kill(signal);
    process.on("SIGINT", forwardSignal);
    process.on("SIGTERM", forwardSignal);

    await new Promise<void>((resolve) => {
      child.on("exit", (code, signal) => {
        process.off("SIGINT", forwardSignal);
        process.off("SIGTERM", forwardSignal);
        if (signal) {
          process.kill(process.pid, signal);
        } else {
          process.exitCode = code ?? 0;
        }
        resolve();
      });
    });
  },
};
