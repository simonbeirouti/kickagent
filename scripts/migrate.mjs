import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const localEnvironment = resolve(scriptDirectory, "../.env.local");
if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations.");

const schema = await readFile(resolve(scriptDirectory, "../db/schema.sql"), "utf8");
const statements = schema
  .split("-- statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = postgres(databaseUrl, { connect_timeout: 10, max: 1 });
try {
  for (const statement of statements) {
    await sql.unsafe(statement);
  }
} finally {
  await sql.end();
}

console.log(`Applied ${statements.length} database statements.`);
