/**
 * End-to-end hype→suggestion validation, runnable WITHOUT a Kick connection.
 *
 * Offline part (always runs in the default suite): feeds deterministic
 * synthetic chat windows through the REAL hype bridge (computeHypeContext) and
 * the REAL prompt builder, asserting the HYPE STATE block reaches the model
 * input for both a low-falling and a high-rising room.
 *
 * Live part (skipped by default): when VALIDATE_HYPE_LIVE=1 and
 * ANTHROPIC_API_KEY are set, makes ONE real claude-haiku call with the same
 * settings as app/api/internal/suggestions/generate and writes the hype
 * context + suggestion to a tmpdir report.
 *
 * Team usage (loads .env.local for you, prints the report):
 *   node scripts/validate-hype-suggestions.mjs
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { describe, expect, it } from "vitest";
import { computeHypeContext, type HypeChatRow } from "@/lib/hype";
import {
  buildSuggestionPrompt,
  SUGGESTION_SYSTEM_PROMPT,
  suggestionGenerationResponseSchema,
  toRequestHype,
} from "@/lib/suggestions";
import { highRisingWindow, lowFallingWindow } from "./helpers/hype-fixtures";

export const VALIDATION_REPORT_PATH = join(tmpdir(), "kickagent-hype-validation.json");

const LIVE =
  process.env.VALIDATE_HYPE_LIVE === "1" && Boolean(process.env.ANTHROPIC_API_KEY);

function lastMessages(rows: readonly HypeChatRow[], count: number) {
  return rows.slice(-count).map((chatRow) => ({
    content: chatRow.content,
    createdAt: chatRow.created_at,
    username: chatRow.sender_username,
  }));
}

function hypeStateLine(prompt: string): string {
  const line = prompt.split("\n\n").find((part) => part.startsWith("HYPE STATE:"));
  expect(line, "prompt must contain a HYPE STATE block").toBeDefined();
  return line!;
}

describe("hype→suggestion validation dry-run", () => {
  it("feeds both synthetic windows through the real bridge into HYPE STATE blocks", () => {
    const scenarios = [
      ["low-falling", lowFallingWindow()],
      ["high-rising", highRisingWindow()],
    ] as const;
    for (const [name, { asOf, rows }] of scenarios) {
      const context = computeHypeContext(rows, asOf);
      const prompt = buildSuggestionPrompt({
        categoryName: "Slots & Casino",
        hype: toRequestHype(context),
        messages: lastMessages(rows, 5),
        recentSuggestions: [],
        streamTitle: "Saturday casino grind",
      });
      const line = hypeStateLine(prompt);
      expect(context.ready).toBe(true);
      console.log(`[validate:${name}] ${line}`);
    }
  });

  it.runIf(LIVE)(
    "makes one real claude-haiku call and reports the suggestion",
    { timeout: 30_000 },
    async () => {
      const { asOf, rows } = lowFallingWindow();
      const context = computeHypeContext(rows, asOf);
      const prompt = buildSuggestionPrompt({
        categoryName: "Slots & Casino",
        hype: toRequestHype(context),
        messages: lastMessages(rows, 5),
        recentSuggestions: [],
        streamTitle: "Saturday casino grind",
      });

      // Mirrors app/api/internal/suggestions/generate exactly (model + caps).
      const { output } = await generateText({
        maxOutputTokens: 120,
        maxRetries: 1,
        model: anthropic("claude-haiku-4-5"),
        output: Output.object({ schema: suggestionGenerationResponseSchema }),
        prompt,
        system: SUGGESTION_SYSTEM_PROMPT,
      });
      const statement = suggestionGenerationResponseSchema.parse(output).statement;

      const report = {
        hypeContext: context,
        hypeStateBlock: hypeStateLine(prompt),
        scenario: "low-falling with trending gap",
        suggestion: statement,
      };
      writeFileSync(VALIDATION_REPORT_PATH, JSON.stringify(report, null, 2));
      console.log(`[validate:live] suggestion: ${statement}`);

      expect(statement.length).toBeLessThanOrEqual(140);
    },
  );
});
