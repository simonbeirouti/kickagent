/**
 * Bridges the starter's event-bus payloads (Kick webhook shapes + the
 * assistant's own economy events) to the hype-engine event shape that
 * `HypeEngine.ingest` consumes: { type: 'chat'|'kicks'|'sub'|'follow',
 * userId, username, badges, text?, raw?, ts }.
 *
 * One event in can fan out to several engine events (gift subs → one 'sub'
 * per giftee) or none (livestream status, assistant chatter).
 */

export type EngineEvent = {
  id?: string;
  type: "chat" | "kicks" | "sub" | "follow" | "ban";
  userId: string;
  username: string;
  badges: string[];
  text?: string;
  raw?: number;
  ts: number;
};

const idOf = (u: unknown, fallback: string): string => {
  const p = u as Record<string, any> | undefined;
  return String(p?.user_id ?? p?.username ?? fallback);
};

const nameOf = (u: unknown, fallback = "viewer"): string => {
  const p = u as Record<string, any> | undefined;
  return String(p?.username ?? fallback);
};

export function toEngineEvents(kind: string, payload: unknown, ts: number): EngineEvent[] {
  const p = payload as Record<string, any> | undefined;
  switch (kind) {
    case "chat.message.sent":
      return [
        {
          id: p?.message_id,
          type: "chat",
          userId: idOf(p?.sender, "anonymous"),
          username: nameOf(p?.sender),
          badges: [],
          text: String(p?.content ?? ""),
          ts,
        },
      ];
    case "channel.followed":
      return [
        { type: "follow", userId: idOf(p?.follower, "anon-follow"), username: nameOf(p?.follower), badges: [], ts },
      ];
    case "channel.subscription.new":
      return [
        { type: "sub", userId: idOf(p?.subscriber, "anon-sub"), username: nameOf(p?.subscriber), badges: [], ts },
      ];
    case "channel.subscription.gifts": {
      const giftees: unknown[] = Array.isArray(p?.giftees) && p.giftees.length ? p.giftees : [{}];
      return giftees.map((g) => ({
        type: "sub" as const,
        userId: idOf(g, idOf(p?.gifter, "anon-gift")),
        username: nameOf(g, nameOf(p?.gifter)),
        badges: [],
        ts,
      }));
    }
    case "kicks.gifted":
      return [
        {
          type: "kicks",
          userId: idOf(p?.gifter, "anon-kicks"),
          username: nameOf(p?.gifter),
          badges: [],
          raw: Number(p?.gift?.amount) || 1,
          ts,
        },
      ];
    // The assistant economy feeds hype too: bets and wagers are real viewer
    // stake, so weigh them like kicks of the same size (log-scaled by the
    // engine, saturated per user like everything else).
    case "assistant.bet.created":
    case "assistant.bet.accepted":
      return [
        {
          type: "kicks",
          userId: `bet:${p?.user ?? "viewer"}`,
          username: String(p?.user ?? "viewer"),
          badges: [],
          raw: Number(p?.wager) || 10,
          ts,
        },
      ];
    case "assistant.prediction.wager":
      return [
        {
          type: "kicks",
          userId: `wager:${p?.user ?? "viewer"}`,
          username: String(p?.user ?? "viewer"),
          badges: [],
          raw: Number(p?.amount) || 10,
          ts,
        },
      ];
    default:
      return [];
  }
}
