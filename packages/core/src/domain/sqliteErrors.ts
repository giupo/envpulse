interface SqliteErrorLike {
  code?: string;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as SqliteErrorLike).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}
