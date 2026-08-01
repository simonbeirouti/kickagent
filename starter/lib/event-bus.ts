import { EventEmitter } from "events";

export type KickEvent = {
  id: string;
  type: string;
  receivedAt: string;
  payload: unknown;
};

const MAX_BUFFER = 100;

class EventBus extends EventEmitter {
  buffer: KickEvent[] = [];

  publish(event: KickEvent) {
    this.buffer.push(event);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
    this.emit("event", event);
  }
}

declare global {
  // survives Next.js dev-mode module reloads
  var __kickEventBus: EventBus | undefined;
}

export const eventBus: EventBus = (globalThis.__kickEventBus ??= new EventBus());
