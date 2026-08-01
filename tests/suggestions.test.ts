import { describe, expect, it } from "vitest";
import { suggestionSchema } from "@/lib/kick/types";
import { buildSuggestionPrompt } from "@/lib/suggestions";

describe("suggestion generation contract", () => {
  it("grounds populated windows and includes anti-repeat context", () => {
    const prompt = buildSuggestionPrompt({
      categoryName: "Just Chatting",
      recentChat: [{ content: "What got you into streaming?", createdAt: "now", username: "sam" }],
      recentSuggestions: ["Tell chat about your first stream."],
      streamTitle: "Late night catch-up",
      windowChat: [{ content: "Favourite setup upgrade?", createdAt: "now", username: "lee" }],
    });
    expect(prompt).toContain("Favourite setup upgrade?");
    expect(prompt).toContain("Tell chat about your first stream.");
    expect(prompt).toContain("Just Chatting");
  });

  it("still provides explicit stream grounding for empty windows", () => {
    const prompt = buildSuggestionPrompt({
      categoryName: "Minecraft",
      recentChat: [],
      recentSuggestions: [],
      streamTitle: "Hardcore day 12",
      windowChat: [],
    });
    expect(prompt).toContain("Hardcore day 12");
    expect(prompt).toContain("(none)");
  });

  it("rejects overlong or invalid structured output", () => {
    expect(suggestionSchema.parse({ basis: "chat", suggestion: "Ask chat about their weekend." })).toEqual({
      basis: "chat",
      suggestion: "Ask chat about their weekend.",
    });
    expect(() => suggestionSchema.parse({ basis: "chat", suggestion: "x".repeat(141) })).toThrow();
    expect(() => suggestionSchema.parse({ basis: "unknown", suggestion: "Hello" })).toThrow();
  });
});
