/**
 * computeHypeContext: replays synthetic chat windows through the real
 * HypeEngine/TopicTracker/HighlightTracker/KickAssistant stack and asserts the
 * full "hype context" the suggestion agent consumes — score/trend, topic
 * momentum, trending-gap analysis, spam flags, and highlight capture.
 */
import { describe, expect, it } from "vitest";
import { computeHypeContext, computeHypeSnapshot } from "@/lib/hype";
import {
  highRisingWindow,
  lowFallingWindow,
  spamFloodWindow,
} from "./helpers/hype-fixtures";

describe("computeHypeContext", () => {
  it("reads a fading room as low-and-falling and spots the trending gap", () => {
    const { asOf, rows } = lowFallingWindow();
    const context = computeHypeContext(rows, asOf);

    expect(context.ready).toBe(true);
    expect(context.score).toBeLessThan(35);
    expect(context.trend).toBe("falling");
    expect(context.topTopics.map((topic) => topic.topic)).toContain("poker");
    // Chat covered "poker" but never touched "slots" — the hottest uncovered
    // entry in the platform trending list (TrendingTopics mock ordering).
    expect(context.trendingGap).toBe("slots");
    expect(context.lastHighlight).toBeNull();
    expect(context.flaggedSpammers).toEqual([]);
  });

  it("reads a burst as high-and-rising and captures the live highlight", () => {
    const { asOf, rows } = highRisingWindow();
    const context = computeHypeContext(rows, asOf);

    expect(context.ready).toBe(true);
    expect(context.score).toBeGreaterThanOrEqual(70);
    expect(context.trend).toBe("rising");
    // The burst carries both the word and the emote; either may top the list.
    expect(context.topTopics.map((topic) => topic.topic)).toContain("poker");
    expect(context.lastHighlight).not.toBeNull();
    expect(context.lastHighlight?.agoSeconds).toBe(0);
    expect(context.lastHighlight?.peak).toBeGreaterThanOrEqual(75);
    expect(context.lastHighlight?.headline).toContain("peak");
  });

  it("flags a copy-paste spammer by username only", () => {
    const { asOf, rows } = spamFloodWindow();
    const context = computeHypeContext(rows, asOf);

    expect(context.flaggedSpammers).toEqual(["spamlord99"]);
  });

  it("honours a custom trending list and reports no gap when chat covers it", () => {
    const { asOf, rows } = lowFallingWindow();
    const context = computeHypeContext(rows, asOf, { trendingTopics: ["poker", "buffet"] });

    expect(context.trendingGap).toBeNull();
  });

  it("stays not-ready with an empty window and reports a dead room", () => {
    const context = computeHypeContext([], Date.parse("2026-08-01T10:00:00.000Z"));

    expect(context.ready).toBe(false);
    expect(context.score).toBe(0);
    expect(context.trend).toBe("steady");
    expect(context.topTopics).toEqual([]);
    expect(context.trendingGap).toBeNull();
    expect(context.lastHighlight).toBeNull();
    expect(context.flaggedSpammers).toEqual([]);
  });

  it("keeps computeHypeSnapshot as the context's snapshot subset", () => {
    const { asOf, rows } = lowFallingWindow();
    const context = computeHypeContext(rows, asOf);
    const snapshot = computeHypeSnapshot(rows, asOf);

    expect(snapshot).toEqual({
      ready: context.ready,
      score: context.score,
      topTopics: context.topTopics,
      trend: context.trend,
    });
  });
});
