import "fastify";
import type { EnvPulseDb, MasterKeyring, TokenScope } from "@envpulse/core";

export interface AuthContext {
  tokenId: string;
  scope: TokenScope;
  projectId: string | null;
  environmentId: string | null;
}

declare module "fastify" {
  interface FastifyInstance {
    db: EnvPulseDb;
    keyring: MasterKeyring;
  }
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}
