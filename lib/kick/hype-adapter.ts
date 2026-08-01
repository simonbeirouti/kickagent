import type { z } from "zod";
import type { kickChatEventSchema } from "@/lib/kick/types";

/**
 * Bridges the Kick webhook ingest path (app/api/kick/webhook) to the hype
 * engine (hype-engine/src/engine.js): converts a verified, schema-parsed
 * `chat.message.sent` payload into the event shape `HypeEngine.ingest`
 * consumes. Keeping the mapping in one place means the webhook route can feed
 * a per-channel engine without either side learning the other's shape.
 */

export type KickChatEvent = z.infer<typeof kickChatEventSchema>;

export interface HypeChatEvent {
  readonly id: string;
  readonly type: "chat";
  readonly userId: string;
  readonly username: string;
  readonly badges: readonly string[];
  readonly text: string;
  readonly ts: number;
}

/**
 * Map a parsed `chat.message.sent` webhook payload to a HypeEngine event.
 *
 * - `ts` is epoch ms (the engine's clock unit), parsed from `created_at`.
 * - Anonymous senders share one userId bucket so they still saturate as a
 *   single "user" instead of each message counting as a fresh viewer.
 * - The webhook payload carries no badge data (see kickChatEventSchema), so
 *   badges are empty — badge multipliers simply don't apply on this path.
 */
export function toHypeChatEvent(event: KickChatEvent): HypeChatEvent {
  return {
    id: event.message_id,
    type: "chat",
    userId: event.sender.user_id ?? "anonymous",
    username: event.sender.username ?? "Anonymous",
    badges: [],
    text: event.content,
    ts: Date.parse(event.created_at),
  };
}
