import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eventBus, type KickEvent } from "@/lib/event-bus";
import { listBets, listPredictions, resetAssistantStore } from "@/lib/assistant/bets-store";
import { DEMO_STEPS, demoStatus, playDemo, stopDemo } from "@/lib/assistant/demo-script";

const NOW = 1_700_000_000_000;

let events: KickEvent[];
const collect = (e: KickEvent) => events.push(e);

// Runs everything inline — the whole story plays out synchronously.
const syncScheduler = (fn: () => void) => {
  fn();
  return 0;
};

beforeEach(() => {
  stopDemo();
  resetAssistantStore();
  events = [];
  eventBus.on("event", collect);
});

afterEach(() => {
  eventBus.off("event", collect);
  stopDemo();
});

describe("playDemo", () => {
  it("runs every step in order and finishes", () => {
    playDemo({ schedule: syncScheduler, now: () => NOW });
    const demoEvents = events
      .filter((e) => e.type === "assistant.demo")
      .map((e) => e.payload as any);
    const steps = demoEvents.filter((p) => p.status === "playing").map((p) => p.step);
    expect(steps).toEqual(DEMO_STEPS.map((s) => s.id));
    expect(demoEvents.at(-1)?.status).toBe("done");
    expect(demoStatus().playing).toBe(false);
  });

  it("drives the bet through the full lifecycle to paid", () => {
    playDemo({ schedule: syncScheduler, now: () => NOW });
    const bets = listBets();
    expect(bets).toHaveLength(1);
    expect(bets[0].status).toBe("paid");
    expect(bets[0].condition).toMatch(/girls on the left/);
  });

  it("spams a chat burst that floods '67'", () => {
    playDemo({ schedule: syncScheduler, now: () => NOW });
    const chats = events.filter((e) => e.type === "fake:chat.message.sent");
    const with67 = chats.filter((e) => String((e.payload as any)?.content).includes("67"));
    expect(with67.length).toBeGreaterThanOrEqual(6);
  });

  it("places wagers on an open prediction when one exists", () => {
    playDemo({ schedule: syncScheduler, now: () => NOW });
    const p = listPredictions()[0];
    expect(p.wagers.length).toBeGreaterThan(0);
  });

  it("is a no-op while already playing", () => {
    const queue: (() => void)[] = [];
    const manual = (fn: () => void) => {
      queue.push(fn);
      return 0;
    };
    playDemo({ schedule: manual, now: () => NOW });
    const scheduled = queue.length;
    playDemo({ schedule: manual, now: () => NOW });
    expect(queue.length).toBe(scheduled);
    expect(demoStatus().playing).toBe(true);
  });

  it("stopDemo halts pending steps", () => {
    const queue: (() => void)[] = [];
    const manual = (fn: () => void) => {
      queue.push(fn);
      return 0;
    };
    playDemo({ schedule: manual, now: () => NOW });
    queue[0]();
    stopDemo();
    queue.slice(1).forEach((fn) => fn());
    expect(listBets()[0]?.status).toBe("open");
    expect(demoStatus().playing).toBe(false);
    const done = events.filter(
      (e) => e.type === "assistant.demo" && (e.payload as any).status === "done",
    );
    expect(done).toHaveLength(0);
  });
});
