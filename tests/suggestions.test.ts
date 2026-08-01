import { describe, expect, it } from "vitest";
import type { HypeContext, HypeSnapshot } from "@/lib/hype";
import { streamAnalysisSchema } from "@/lib/kick/types";
import {
  buildSuggestionPrompt,
  suggestionGenerationRequestSchema,
  suggestionGenerationResponseSchema,
  toRequestHype,
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
    expect(prompt).toContain("HYPE STATE:");
    expect(prompt).toContain("score 82/100");
    expect(prompt).toContain("trend rising");
    expect(prompt).toContain("poker (rising)");
    expect(prompt).toContain("backflip (falling)");
  });

  it("renders the full HYPE STATE block for a low-and-falling room with a trending gap", () => {
    const context: HypeContext = {
      flaggedSpammers: ["spamlord99"],
      lastHighlight: null,
      ready: true,
      score: 22,
      topTopics: [
        { mentions: 9, topic: "poker", trend: "rising" },
        { mentions: 4, topic: "buffet", trend: "steady" },
      ],
      trend: "falling",
      trendingGap: "slots",
    };
    const prompt = buildSuggestionPrompt({
      hype: toRequestHype(context),
      messages: [],
      recentSuggestions: [],
    });
    expect(prompt).toContain("HYPE STATE:");
    expect(prompt).toContain("hype score 22/100, trend falling");
    expect(prompt).toContain("chat is on: poker (rising), buffet (steady)");
    expect(prompt).toContain('trending gap: "slots" is hot on KICK but chat has not touched it');
    expect(prompt).toContain("spam shield: flagged spamlord99");
    expect(prompt).not.toContain("last highlight:");
  });

  it("renders the highlight clause for a high-and-rising room", () => {
    const context: HypeContext = {
      flaggedSpammers: [],
      lastHighlight: { agoSeconds: 180, headline: "500 Kicks gifted by whale — peak 84", peak: 84 },
      ready: true,
      score: 88,
      topTopics: [{ mentions: 14, topic: "poker", trend: "rising" }],
      trend: "rising",
      trendingGap: null,
    };
    const prompt = buildSuggestionPrompt({
      hype: toRequestHype(context),
      messages: [],
      recentSuggestions: [],
    });
    expect(prompt).toContain("hype score 88/100, trend rising");
    expect(prompt).toContain('last highlight: "500 Kicks gifted by whale — peak 84" (3m ago)');
    expect(prompt).not.toContain("trending gap:");
    expect(prompt).not.toContain("spam shield:");
  });

  it("marks a still-open highlight as live now", () => {
    const prompt = buildSuggestionPrompt({
      hype: {
        lastHighlight: { agoSeconds: 0, headline: "Chat erupted over poker — peak 91", peak: 91 },
        ready: true,
        score: 91,
        topTopics: [],
        trend: "rising",
      },
      messages: [],
      recentSuggestions: [],
    });
    expect(prompt).toContain('"Chat erupted over poker — peak 91" (live now)');
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

  it("omits the hype block entirely when no context is supplied", () => {
    const prompt = buildSuggestionPrompt({ messages: [], recentSuggestions: [] });
    expect(prompt).not.toContain("Hype engine:");
    expect(prompt).not.toContain("HYPE STATE:");
  });

  it("accepts a bare hype snapshot in the generation request", () => {
    const parsed = suggestionGenerationRequestSchema.parse({
      hype: { ready: true, score: 55, topTopics: [], trend: "steady" },
      messages: [],
      recentSuggestions: [],
    });
    expect(parsed.hype?.score).toBe(55);
  });

  it("accepts the extended hype context in the generation request", () => {
    const parsed = suggestionGenerationRequestSchema.parse({
      hype: {
        flaggedSpammers: ["spamlord99"],
        lastHighlight: { agoSeconds: 42, headline: "Hype spike — peak 79", peak: 79 },
        ready: true,
        score: 18,
        topTopics: [{ mentions: 5, topic: "poker", trend: "rising" }],
        trend: "falling",
        trendingGap: "slots",
      },
      messages: [],
      recentSuggestions: [],
    });
    expect(parsed.hype?.trendingGap).toBe("slots");
    expect(parsed.hype?.lastHighlight?.peak).toBe(79);
    expect(parsed.hype?.flaggedSpammers).toEqual(["spamlord99"]);
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
