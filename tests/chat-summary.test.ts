import { describe, expect, it } from "vitest";
import { buildChatSummaryPrompt } from "@/lib/chat-summary";
import { nextChatSummaryWindow } from "@/lib/kick/chat-summary-window";
import { chatSummarySchema } from "@/lib/kick/types";

describe("chat summary windowing", () => {
  it("aligns to UTC 20-second windows", () => {
    expect(nextChatSummaryWindow(new Date("2026-08-01T01:02:19.999Z"))).toEqual({
      end: new Date("2026-08-01T01:02:20.000Z"),
      start: new Date("2026-08-01T01:02:00.000Z"),
    });
    expect(nextChatSummaryWindow(new Date("2026-08-01T01:02:20.000Z"))).toEqual({
      end: new Date("2026-08-01T01:02:40.000Z"),
      start: new Date("2026-08-01T01:02:20.000Z"),
    });
  });
});

describe("chat summary prompt", () => {
  it("grounds the prompt in the supplied window", () => {
    const prompt = buildChatSummaryPrompt({
      windowChat: [{ content: "can you play the new map?", createdAt: "now", username: "sam" }],
    });
    expect(prompt).toContain("can you play the new map?");
    expect(prompt).not.toContain("Previous window's summary");
  });

  it("includes prior summary context for continuity without duplicating it as an instruction", () => {
    const prompt = buildChatSummaryPrompt({
      previousSummary: "Chat was hyped about the last round.",
      windowChat: [],
    });
    expect(prompt).toContain("Chat was hyped about the last round.");
    expect(prompt).toContain("(none)");
  });
});

describe("chat summary output contract", () => {
  it("accepts a well-formed summary", () => {
    expect(
      chatSummarySchema.parse({
        interest: "high",
        purpose: "Reacting to a clutch play.",
        requests: ["play the new map"],
        summary: "Chat is hyped after the clutch round.",
        suggestions: ["Ask chat what they want to see next."],
        tone: "excited",
      }),
    ).toMatchObject({ interest: "high", tone: "excited" });
  });

  it("rejects invalid interest values and empty suggestions", () => {
    expect(() =>
      chatSummarySchema.parse({
        interest: "extreme",
        purpose: "x",
        requests: [],
        summary: "x",
        suggestions: ["ok"],
        tone: "x",
      }),
    ).toThrow();
    expect(() =>
      chatSummarySchema.parse({
        interest: "low",
        purpose: "x",
        requests: [],
        summary: "x",
        suggestions: [],
        tone: "x",
      }),
    ).toThrow();
  });
});
