import { describe, expect, it } from "vitest";
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
    expect(prompt).toContain("There is no new chat");
    expect(prompt).toContain("conversation starter");
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
