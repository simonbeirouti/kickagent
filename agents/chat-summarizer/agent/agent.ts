import { anthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

export default defineAgent({
  model: anthropic("claude-haiku-4-5"),
  reasoning: "low",
  limits: {
    maxInputTokensPerSession: 6_000,
    maxOutputTokensPerSession: 400,
  },
});
