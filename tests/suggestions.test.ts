import { describe, expect, it } from "vitest";
import type { HypeSnapshot } from "@/lib/hype";
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

  it("includes the hype score, trend, and topics when the baseline is locked", () => {
    const hype: HypeSnapshot = {
      ready: true,
      score: 82,
      topTopics: [
        { mentions: 6, topic: "poker", trend: "rising" },
        { mentions: 3, topic: "backflip", trend: "falling" },
      ],
      trend: "rising",
    };
    const prompt = buildSuggestionPrompt({
      hype,
      recentChat: [],
      recentSuggestions: [],
      windowChat: [],
    });
    expect(prompt).toContain("score 82/100");
    expect(prompt).toContain("trend rising");
    expect(prompt).toContain("poker (rising)");
    expect(prompt).toContain("backflip (falling)");
  });

  it("flags an uncalibrated baseline instead of stating a score", () => {
    const hype: HypeSnapshot = { ready: false, score: 12, topTopics: [], trend: "steady" };
    const prompt = buildSuggestionPrompt({
      hype,
      recentChat: [],
      recentSuggestions: [],
      windowChat: [],
    });
    expect(prompt).toContain("still calibrating");
    expect(prompt).not.toContain("score 12/100");
  });

  it("omits the hype line entirely when no snapshot is supplied", () => {
    const prompt = buildSuggestionPrompt({ recentChat: [], recentSuggestions: [], windowChat: [] });
    expect(prompt).not.toContain("Hype engine:");
  });

  it("rejects overlong or invalid structured output", () => {
    expect(
      suggestionSchema.parse({
        basis: "chat",
        insight: "Chat's cooling off after the poker talk faded.",
        suggestion: "Ask chat about their weekend.",
      }),
    ).toEqual({
      basis: "chat",
      insight: "Chat's cooling off after the poker talk faded.",
      suggestion: "Ask chat about their weekend.",
    });
    expect(() =>
      suggestionSchema.parse({ basis: "chat", insight: "x".repeat(141), suggestion: "Hello" }),
    ).toThrow();
    expect(() =>
      suggestionSchema.parse({ basis: "chat", suggestion: "x".repeat(141) }),
    ).toThrow();
    expect(() => suggestionSchema.parse({ basis: "unknown", suggestion: "Hello" })).toThrow();
  });
});
