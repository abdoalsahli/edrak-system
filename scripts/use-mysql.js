/**
 * Local development on MySQL while the project itself targets SQL Server.
 *
 * Writes prisma/.schema.mysql.prisma — the same schema with provider "mysql"
 * (git-ignored) — and generates the Prisma Client from it, so `npm run dev:mysql`
 * runs against the local MySQL database in .env. The server is not affected:
 * `npm ci` there regenerates the client from prisma/schema.prisma (SQL Server).
 *
 * SQL Server native types are mapped to MySQL ones (NVarChar(Max) → Text). The
 * value-list and JSON fields are plain strings in the schema, which the local
 * database's ENUM and JSON columns accept.
 *
 * The local MySQL database must already have the tables (it does: they come
 * from the MySQL migrations in the git history).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const source = path.join(root, "prisma", "schema.prisma");
const target = path.join(root, "prisma", ".schema.mysql.prisma");

const schema = fs.readFileSync(source, "utf8");
if (!/provider\s*=\s*"sqlserver"/.test(schema)) {
  console.error("prisma/schema.prisma is not set to sqlserver — nothing to do.");
  process.exit(1);
}
fs.writeFileSync(
  target,
  schema
    .replace(/provider\s*=\s*"sqlserver"/, 'provider = "mysql"')
    .replace(/@db\.NVarChar\(Max\)/g, "@db.Text")
);

execSync(`npx prisma generate --schema "${target}"`, { cwd: root, stdio: "inherit" });
console.log("✔ Prisma Client generated for local MySQL");
