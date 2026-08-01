import { randomUUID } from "crypto";
import { eventBus } from "@/lib/event-bus";

export function publishAssistant(type: string, payload: unknown): void {
  eventBus.publish({
    id: randomUUID(),
    type,
    receivedAt: new Date().toISOString(),
    payload,
  });
}
