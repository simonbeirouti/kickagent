import { describe, it, expect, vi } from "vitest";
import { eventBus, KickEvent } from "@/lib/event-bus";

function makeEvent(n: number): KickEvent {
  return { id: `id-${n}`, type: "test.event", receivedAt: "2026-07-27T00:00:00Z", payload: { n } };
}

describe("eventBus", () => {
  it("notifies listeners on publish", () => {
    const listener = vi.fn();
    eventBus.on("event", listener);
    const event = makeEvent(1);
    eventBus.publish(event);
    eventBus.off("event", listener);
    expect(listener).toHaveBeenCalledWith(event);
  });

  it("buffers published events in order", () => {
    eventBus.buffer.length = 0;
    eventBus.publish(makeEvent(1));
    eventBus.publish(makeEvent(2));
    expect(eventBus.buffer.map((e) => e.id)).toEqual(["id-1", "id-2"]);
  });

  it("caps the buffer at 100 events, dropping oldest", () => {
    eventBus.buffer.length = 0;
    for (let i = 0; i < 105; i++) eventBus.publish(makeEvent(i));
    expect(eventBus.buffer).toHaveLength(100);
    expect(eventBus.buffer[0].id).toBe("id-5");
    expect(eventBus.buffer[99].id).toBe("id-104");
  });
});
