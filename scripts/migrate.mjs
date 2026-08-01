import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const schema = await readFile(resolve(scriptDirectory, "../db/schema.sql"), "utf8");
const statements = schema
  .split("-- statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(databaseUrl);
for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Applied ${statements.length} database statements.`);
