#!/usr/bin/env node
/**
 * Validates the hype→Claude suggestion path end-to-end WITHOUT a Kick
 * connection: replays synthetic chat windows through the real hype bridge and
 * prompt builder, and — when ANTHROPIC_API_KEY is available (set in the
 * environment or in .env.local) — makes ONE real claude-haiku call, then
 * prints the hype context and the suggestion it produced.
 *
 * Usage: node scripts/validate-hype-suggestions.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(tmpdir(), "kickagent-hype-validation.json");

// Load .env.local the way Next.js would, without ever printing values.
const envFile = join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^(["'])(.*)\1$/, "$2");
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "ANTHROPIC_API_KEY not found (env or .env.local) — running the offline dry-run only.",
  );
}

rmSync(reportPath, { force: true });

const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules", "vitest", "vitest.mjs"),
    "run",
    "tests/hype-suggestion-validation.test.ts",
  ],
  {
    cwd: root,
    env: { ...process.env, VALIDATE_HYPE_LIVE: "1" },
    stdio: "inherit",
  },
);

if (existsSync(reportPath)) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  console.log("\n=== hype→suggestion validation report ===");
  console.log(`scenario:   ${report.scenario}`);
  console.log(`hype state: ${report.hypeStateBlock}`);
  console.log("hype context:");
  console.log(JSON.stringify(report.hypeContext, null, 2));
  console.log(`\nClaude (claude-haiku-4-5) suggestion:\n  ${report.suggestion}`);
} else if (process.env.ANTHROPIC_API_KEY) {
  console.error("\nNo validation report was produced — check the vitest output above.");
}

process.exit(result.status ?? 1);
