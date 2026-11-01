/**
 * SQL Server lets a UNIQUE constraint hold only one NULL, so «unique when set»
 * columns (a therapist's optional login, a patient's optional national ID, a
 * session's number within a program, …) would refuse a second empty value.
 *
 * This rewrites a Prisma-generated SQL Server migration: every UNIQUE
 * constraint that covers a nullable column becomes a filtered unique index
 * («… WHERE col IS NOT NULL»), which behaves like PostgreSQL and MySQL do.
 *
 *   node scripts/sqlserver-nullable-unique.js prisma/migrations/<name>/migration.sql
 *
 * Run it on every new migration that adds such a constraint.
 */
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/sqlserver-nullable-unique.js <migration.sql>");
  process.exit(1);
}
let sql = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const added = [];

sql = sql.replace(/CREATE TABLE \[dbo\]\.\[(\w+)\] \(\n([\s\S]*?)\n\);\n/g, (block, table, body) => {
  const lines = body.split("\n");
  const nullable = new Set(
    lines
      .map((l) => l.match(/^\s+\[(\w+)\] [A-Z]+(?:\([^)]*\))?(.*?),?$/))
      .filter((m) => m && !/NOT NULL/.test(m[2]))
      .map((m) => m[1])
  );
  const indexes = [];
  const kept = lines.filter((l) => {
    const m = l.match(/^\s+CONSTRAINT \[(\w+)\] UNIQUE NONCLUSTERED \(([^)]*)\),?$/);
    if (!m) return true;
    const cols = m[2].split(",").map((c) => c.trim().replace(/^\[|\]$/g, ""));
    const open = cols.filter((c) => nullable.has(c));
    if (open.length === 0) return true;
    indexes.push(
      `CREATE UNIQUE NONCLUSTERED INDEX [${m[1]}] ON [dbo].[${table}]([${cols.join("], [")}]) WHERE ${open.map((c) => `[${c}] IS NOT NULL`).join(" AND ")};`
    );
    added.push(`${table}.${m[1]}`);
    return false;
  });
  // The last remaining line of the table must not end with a comma
  const last = kept.length - 1;
  kept[last] = kept[last].replace(/,$/, "");
  return `CREATE TABLE [dbo].[${table}] (\n${kept.join("\n")}\n);\n` + (indexes.length ? `\n-- Unique when set (a filtered index allows many NULLs)\n${indexes.join("\n")}\n` : "");
});

fs.writeFileSync(file, sql);
console.log(added.length ? `filtered unique indexes:\n  ${added.join("\n  ")}` : "nothing to change");
