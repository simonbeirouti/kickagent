/**
 * Integration test for the hype stack behind app/overlay/page.tsx.
 *
 * Reproduces the overlay's exact wiring headlessly — HypeEngine + TopicTracker
 * + KickAssistant fed by the deterministic scripted replay, sampled at 4 Hz on
 * a virtual clock, with the "Hit Me, Kick Me" dare tracked at 171s — and
 * asserts the demo arc the overlay depends on:
 *
 *   - baseline locks (ready) exactly when the 45s warm-up ends
 *   - the ramp phase peaks high enough to read as a real pop-off
 *   - the spam flood flags the spammer without spiking the meter
 *   - a pivot suggestion fires during the lull
 *   - the dare's measured impact verdict is "up"
 *
 * No DOM, no timers: the engine stack is plain JS driven by explicit `ts`
 * values, so the whole 4.5-minute replay runs in milliseconds.
 */
import { describe, expect, it } from "vitest";
import { KickAssistant } from "@/hype-engine/src/assistant.js";
import { HypeEngine } from "@/hype-engine/src/engine.js";
import { createScriptedReplay } from "@/hype-engine/src/mock.js";
import { TopicTracker } from "@/hype-engine/src/topics.js";

// Mirrors app/overlay/page.tsx.
const SAMPLE_MS = 250; // 4 Hz
const REPLAY_END_MS = 272_000;
const DARE_AT_MS = 171_000;

interface Sample {
  readonly now: number;
  readonly hype: number;
  readonly trend: string;
  readonly ready: boolean;
  readonly flaggedUsers: readonly { userId: string }[];
}

interface Suggestion {
  readonly kind: string;
  readonly ts: number;
  readonly text: string;
}

interface Impact {
  readonly verdict: string;
  readonly delta: number;
}

function runOverlayReplay() {
  const engine = new HypeEngine();
  const topics = new TopicTracker();
  const assistant = new KickAssistant(engine, topics);

  const samples: Sample[] = [];
  const suggestions: Suggestion[] = [];
  const impacts: Impact[] = [];
  let readyAt: number | null = null;

  assistant
    .on("ready", (p: { ts: number }) => (readyAt = p.ts))
    .on("suggestion", (p: Suggestion) => suggestions.push(p))
    .on("impact", (p: Impact) => impacts.push(p));

  const events = createScriptedReplay();
  let idx = 0;
  let dareTracked = false;

  // Same loop as the overlay's setInterval body, on a virtual clock.
  for (let elapsed = 0; elapsed <= REPLAY_END_MS; elapsed += SAMPLE_MS) {
    while (idx < events.length && events[idx].ts <= elapsed) {
      const ev = events[idx++];
      const w = engine.ingest(ev);
      if (ev.type === "chat" && !engine.isFlagged(ev.userId)) topics.ingest(ev, w);
    }
    if (!dareTracked && elapsed >= DARE_AT_MS) {
      dareTracked = true;
      assistant.trackAction("Hit Me, Kick Me", elapsed);
    }
    const state = engine.sample(elapsed);
    assistant.onSample(state, elapsed);
    samples.push({ now: elapsed, ...state });
  }

  return { engine, impacts, readyAt, samples, suggestions, topics };
}

const inWindow = (samples: readonly Sample[], t0: number, t1: number) =>
  samples.filter((s) => s.now >= t0 && s.now < t1);

describe("overlay wiring: engine + topics + assistant on the scripted replay", () => {
  const r = runOverlayReplay();

  it("locks the baseline exactly when the 45s warm-up ends", () => {
    expect(r.readyAt).toBe(45_000);
    expect(inWindow(r.samples, 0, 45_000).every((s) => !s.ready)).toBe(true);
  });

  it("ramp phase (50–100s) peaks at 75+ hype", () => {
    const peak = Math.max(...inWindow(r.samples, 50_000, 100_000).map((s) => s.hype));
    expect(peak).toBeGreaterThanOrEqual(75);
  });

  it("flags the spam flood without letting it spike the meter", () => {
    expect(r.engine.isFlagged("xX_botlord_Xx")).toBe(true);
    const legit = r.samples
      .at(-1)!
      .flaggedUsers.map((f) => f.userId)
      .filter((id) => id !== "xX_botlord_Xx");
    expect(legit).toEqual([]);

    const rampPeak = Math.max(...inWindow(r.samples, 50_000, 100_000).map((s) => s.hype));
    const spamSlice = inWindow(r.samples, 100_000, 120_000).map((s) => s.hype);
    const spamMean = spamSlice.reduce((a, b) => a + b, 0) / spamSlice.length;
    expect(spamMean).toBeLessThan(rampPeak);
  });

  it("fires a suggestion during the lull (120–175s)", () => {
    const lull = r.suggestions.find((s) => s.ts >= 120_000 && s.ts <= 175_000);
    expect(lull).toBeDefined();
  });

  it("measures the Hit Me, Kick Me dare as hype UP", () => {
    expect(r.impacts.length).toBeGreaterThanOrEqual(1);
    expect(r.impacts[0]!.verdict).toBe("up");
    expect(r.impacts[0]!.delta).toBeGreaterThanOrEqual(8);
  });

  it("is deterministic: a second replay produces the identical hype curve", () => {
    const again = runOverlayReplay();
    expect(again.samples.map((s) => s.hype)).toEqual(r.samples.map((s) => s.hype));
  });
});
