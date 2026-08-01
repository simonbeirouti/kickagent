import { describe, expect, it } from "vitest";
import { streamAnalysisSchema } from "@/lib/kick/types";
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
    const analysis = {
      basis: "chat",
      hypeScore: 70,
      summary: "Chat is discussing weekend plans.",
      suggestion: "Ask chat about their weekend.",
      topics: [{ label: "Weekend plans", percentage: 65 }],
    } as const;
    expect(streamAnalysisSchema.parse(analysis)).toEqual(analysis);
    expect(() => streamAnalysisSchema.parse({ ...analysis, suggestion: "x".repeat(141) })).toThrow();
    expect(() => streamAnalysisSchema.parse({ ...analysis, basis: "unknown" })).toThrow();
  });
});
