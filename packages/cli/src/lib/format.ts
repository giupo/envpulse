export function printTable(rows: Record<string, string | number>[]): void {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  const columns = Object.keys(rows[0]!);
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((r) => String(r[col]).length)),
  );
  const printRow = (values: string[]) =>
    console.log(values.map((v, i) => v.padEnd(widths[i]!)).join("  "));

  printRow(columns);
  printRow(widths.map((w) => "-".repeat(w)));
  for (const row of rows) {
    printRow(columns.map((col) => String(row[col])));
  }
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
