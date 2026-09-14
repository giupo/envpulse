import type {
  AuditEntry,
  Environment,
  Project,
  Secret,
  SecretVersion,
  TokenSummary,
  WhoAmI,
} from "./apiTypes.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientConfig {
  host: string;
  token: string;
}

export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  private async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; query?: Record<string, string> } = {},
  ): Promise<T> {
    const url = new URL(`/api/v1${path}`, this.config.host);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const err = data?.error ?? { code: "UNKNOWN", message: res.statusText };
      throw new ApiError(res.status, err.code, err.message);
    }
    return data as T;
  }

  health() {
    return this.request<{ status: string; version: string }>("GET", "/health");
  }

  whoami() {
    return this.request<WhoAmI>("GET", "/whoami");
  }

  createProject(input: { slug: string; name: string }) {
    return this.request<Project>("POST", "/projects", { body: input });
  }

  listProjects() {
    return this.request<{ projects: Project[] }>("GET", "/projects");
  }

  getProject(slug: string) {
    return this.request<Project & { environments: { slug: string; name: string }[] }>(
      "GET",
      `/projects/${encodeURIComponent(slug)}`,
    );
  }

  deleteProject(slug: string) {
    return this.request<void>("DELETE", `/projects/${encodeURIComponent(slug)}`);
  }

  createEnvironment(projectSlug: string, input: { slug: string; name: string }) {
    return this.request<Environment>(
      "POST",
      `/projects/${encodeURIComponent(projectSlug)}/environments`,
      { body: input },
    );
  }

  listEnvironments(projectSlug: string) {
    return this.request<{ environments: Environment[] }>(
      "GET",
      `/projects/${encodeURIComponent(projectSlug)}/environments`,
    );
  }

  deleteEnvironment(projectSlug: string, envSlug: string) {
    return this.request<void>(
      "DELETE",
      `/projects/${encodeURIComponent(projectSlug)}/environments/${encodeURIComponent(envSlug)}`,
    );
  }

  listSecrets(projectSlug: string, envSlug: string, reveal = false) {
    return this.request<{ secrets: Secret[] }>(
      "GET",
      `/projects/${encodeURIComponent(projectSlug)}/environments/${encodeURIComponent(envSlug)}/secrets`,
      { query: { reveal: String(reveal) } },
    );
  }

  setSecret(projectSlug: string, envSlug: string, key: string, value: string) {
    return this.request<Secret>(
      "PUT",
      `/projects/${encodeURIComponent(projectSlug)}/environments/${encodeURIComponent(envSlug)}/secrets/${encodeURIComponent(key)}`,
      { body: { value } },
    );
  }

  getSecret(projectSlug: string, envSlug: string, key: string) {
    return this.request<Secret>(
      "GET",
      `/projects/${encodeURIComponent(projectSlug)}/environments/${encodeURIComponent(envSlug)}/secrets/${encodeURIComponent(key)}`,
    );
  }

  deleteSecret(projectSlug: string, envSlug: string, key: string) {
    return this.request<void>(
      "DELETE",
      `/projects/${encodeURIComponent(projectSlug)}/environments/${encodeURIComponent(envSlug)}/secrets/${encodeURIComponent(key)}`,
    );
  }

  historySecret(projectSlug: string, envSlug: string, key: string, reveal = false) {
    return this.request<{ versions: SecretVersion[] }>(
      "GET",
      `/projects/${encodeURIComponent(projectSlug)}/environments/${encodeURIComponent(envSlug)}/secrets/${encodeURIComponent(key)}/history`,
      { query: { reveal: String(reveal) } },
    );
  }

  rollbackSecret(projectSlug: string, envSlug: string, key: string, toVersion: number) {
    return this.request<Secret>(
      "POST",
      `/projects/${encodeURIComponent(projectSlug)}/environments/${encodeURIComponent(envSlug)}/secrets/${encodeURIComponent(key)}/rollback`,
      { body: { toVersion } },
    );
  }

  bulkSetSecrets(
    projectSlug: string,
    envSlug: string,
    values: Record<string, string>,
    mode: "merge" | "overwrite",
  ) {
    return this.request<{ updated: string[]; deleted: string[] }>(
      "POST",
      `/projects/${encodeURIComponent(projectSlug)}/environments/${encodeURIComponent(envSlug)}/secrets/bulk`,
      { body: { secrets: values, mode } },
    );
  }

  createToken(input: {
    name: string;
    scope: "project" | "environment";
    projectSlug: string;
    envSlug?: string;
  }) {
    return this.request<{ id: string; name: string; scope: string; token: string }>(
      "POST",
      "/tokens",
      { body: input },
    );
  }

  listTokens() {
    return this.request<{ tokens: TokenSummary[] }>("GET", "/tokens");
  }

  revokeToken(id: string) {
    return this.request<void>("DELETE", `/tokens/${encodeURIComponent(id)}`);
  }

  listAudit(limit?: number) {
    return this.request<{ entries: AuditEntry[] }>("GET", "/audit", {
      query: limit !== undefined ? { limit: String(limit) } : undefined,
    });
  }
}
