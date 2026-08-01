import { describe, expect, it } from "vitest";
import type { HypeSnapshot } from "@/lib/hype";
import { streamAnalysisSchema } from "@/lib/kick/types";
import {
  buildSuggestionPrompt,
  suggestionGenerationRequestSchema,
  suggestionGenerationResponseSchema,
} from "@/lib/suggestions";

describe("suggestion generation contract", () => {
  it("grounds populated windows and includes anti-repeat context", () => {
    const prompt = buildSuggestionPrompt({
      categoryName: "Just Chatting",
      messages: [{ content: "Favourite setup upgrade?", createdAt: "now", username: "lee" }],
      recentSuggestions: ["Tell chat about your first stream."],
      streamTitle: "Late night catch-up",
    });
    expect(prompt).toContain("Favourite setup upgrade?");
    expect(prompt).toContain("Tell chat about your first stream.");
    expect(prompt).toContain("Just Chatting");
    expect(prompt).toContain("<untrusted_chat_records");
    expect(prompt).toContain("</untrusted_chat_records>");
  });

  it("still provides explicit stream grounding for empty windows", () => {
    const prompt = buildSuggestionPrompt({
      categoryName: "Minecraft",
      messages: [],
      recentSuggestions: [],
      streamTitle: "Hardcore day 12",
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
      hype: { ...hype, topTopics: hype.topTopics.map((topic) => ({ ...topic })) },
      messages: [],
      recentSuggestions: [],
    });
    expect(prompt).toContain("score 82/100");
    expect(prompt).toContain("trend rising");
    expect(prompt).toContain("poker (rising)");
    expect(prompt).toContain("backflip (falling)");
  });

  it("flags an uncalibrated baseline instead of stating a score", () => {
    const prompt = buildSuggestionPrompt({
      hype: { ready: false, score: 12, topTopics: [], trend: "steady" },
      messages: [],
      recentSuggestions: [],
    });
    expect(prompt).toContain("still calibrating");
    expect(prompt).not.toContain("score 12/100");
  });

  it("omits the hype line entirely when no snapshot is supplied", () => {
    const prompt = buildSuggestionPrompt({ messages: [], recentSuggestions: [] });
    expect(prompt).not.toContain("Hype engine:");
  });

  it("accepts a hype snapshot in the generation request", () => {
    const parsed = suggestionGenerationRequestSchema.parse({
      hype: { ready: true, score: 55, topTopics: [], trend: "steady" },
      messages: [],
      recentSuggestions: [],
    });
    expect(parsed.hype?.score).toBe(55);
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

  it("enforces the request and response bounds", () => {
    const message = { content: "hello", createdAt: "now", username: "viewer" };
    expect(() => suggestionGenerationRequestSchema.parse({
      messages: Array.from({ length: 6 }, () => message),
      recentSuggestions: [],
    })).toThrow();
    expect(suggestionGenerationResponseSchema.parse({ statement: "Ask chat about their weekend." }))
      .toEqual({ statement: "Ask chat about their weekend." });
    expect(() => suggestionGenerationResponseSchema.parse({ statement: "x".repeat(141) })).toThrow();
    expect(() => suggestionGenerationResponseSchema.parse({ statement: "" })).toThrow();
  });
});
