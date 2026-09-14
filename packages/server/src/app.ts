import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { EnvPulseDb, MasterKeyring } from "@envpulse/core";
import "./types.js";
import { authPlugin } from "./plugins/auth.js";
import { errorHandlerPlugin } from "./plugins/errorHandler.js";
import { healthRoutes } from "./routes/health.js";
import { projectRoutes } from "./routes/projects.js";
import { environmentRoutes } from "./routes/environments.js";
import { secretRoutes } from "./routes/secrets.js";
import { tokenRoutes } from "./routes/tokens.js";
import { auditRoutes } from "./routes/audit.js";

export interface AppDeps {
  db: EnvPulseDb;
  keyring: MasterKeyring;
  logger?: boolean;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate("db", deps.db);
  app.decorate("keyring", deps.keyring);

  app.register(errorHandlerPlugin);
  app.register(authPlugin);

  app.register(healthRoutes, { prefix: "/api/v1" });
  app.register(projectRoutes, { prefix: "/api/v1" });
  app.register(environmentRoutes, { prefix: "/api/v1" });
  app.register(secretRoutes, { prefix: "/api/v1" });
  app.register(tokenRoutes, { prefix: "/api/v1" });
  app.register(auditRoutes, { prefix: "/api/v1" });

  return app;
}
