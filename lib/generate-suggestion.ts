import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import {
  buildSuggestionPrompt,
  SUGGESTION_SYSTEM_PROMPT,
  suggestionGenerationResponseSchema,
  type SuggestionGenerationRequest,
} from "@/lib/suggestions";

export const SUGGESTION_GENERATION_TIMEOUT_MS = 15_000;

export class SuggestionGenerationTimeoutError extends Error {
  constructor() {
    super("Suggestion generation timed out.");
    this.name = "SuggestionGenerationTimeoutError";
  }
}

export async function generateSuggestion(
  input: SuggestionGenerationRequest,
): Promise<string> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SUGGESTION_GENERATION_TIMEOUT_MS);

  try {
    const { output } = await generateText({
      abortSignal: controller.signal,
      maxOutputTokens: 120,
      maxRetries: 1,
      model: anthropic("claude-haiku-4-5"),
      output: Output.object({ schema: suggestionGenerationResponseSchema }),
      prompt: buildSuggestionPrompt(input),
      system: SUGGESTION_SYSTEM_PROMPT,
    });
    return suggestionGenerationResponseSchema.parse(output).statement;
  } catch (error) {
    if (timedOut) throw new SuggestionGenerationTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
