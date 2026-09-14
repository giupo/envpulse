export interface Project {
  id: string;
  slug: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Environment {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Secret {
  key: string;
  version: number;
  updatedAt: number;
  value?: string;
}

export interface SecretVersion {
  version: number;
  createdAt: number;
  createdByTokenId: string | null;
  value?: string;
}

export interface TokenSummary {
  id: string;
  name: string;
  scope: "root" | "project" | "environment";
  projectId: string | null;
  environmentId: string | null;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface WhoAmI {
  scope: string;
  projectId: string | null;
  environmentId: string | null;
}

export interface AuditEntry {
  id: string;
  tokenId: string | null;
  action: string;
  projectId: string | null;
  environmentId: string | null;
  secretKey: string | null;
  metadata: unknown;
  createdAt: number;
}
