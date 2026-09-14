import { randomUUID } from "node:crypto";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const timestamps = {
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
};

export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("projects_slug_unique").on(table.slug)],
);

export const environments = sqliteTable(
  "environments",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("environments_project_slug_unique").on(
      table.projectId,
      table.slug,
    ),
  ],
);

export const secrets = sqliteTable(
  "secrets",
  {
    id: id(),
    environmentId: text("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    // Forward reference: secretVersions is declared below. The thunk defers
    // evaluation until after the module finishes loading, so the binding is
    // populated by the time drizzle actually resolves it.
    currentVersionId: text("current_version_id").references(
      (): AnySQLiteColumn => secretVersions.id,
    ),
    deletedAt: integer("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("secrets_environment_key_unique").on(
      table.environmentId,
      table.key,
    ),
    index("secrets_environment_id_idx").on(table.environmentId),
  ],
);

export const tokens = sqliteTable(
  "tokens",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    name: text("name").notNull(),
    scope: text("scope", { enum: ["root", "project", "environment"] }).notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    environmentId: text("environment_id").references(() => environments.id, {
      onDelete: "cascade",
    }),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"),
  },
  (table) => [uniqueIndex("tokens_token_hash_unique").on(table.tokenHash)],
);

export const secretVersions = sqliteTable(
  "secret_versions",
  {
    id: id(),
    secretId: text("secret_id")
      .notNull()
      .references(() => secrets.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    createdByTokenId: text("created_by_token_id").references(() => tokens.id),
  },
  (table) => [
    uniqueIndex("secret_versions_secret_version_unique").on(
      table.secretId,
      table.version,
    ),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    // set null (not cascade) on delete: audit history should survive the
    // resource it references being removed, e.g. after project.delete.
    tokenId: text("token_id").references(() => tokens.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    environmentId: text("environment_id").references(() => environments.id, {
      onDelete: "set null",
    }),
    secretKey: text("secret_key"),
    metadata: text("metadata"),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("audit_log_project_created_idx").on(table.projectId, table.createdAt)],
);
