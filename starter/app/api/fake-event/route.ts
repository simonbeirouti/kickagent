import { randomUUID } from "crypto";
import { eventBus } from "@/lib/event-bus";

const USERNAMES = [
  "fake_viewer", "hype_hannah", "pog_pedro", "clutch_carla", "stream_sniper",
  "kick_kevin", "emote_emma", "lurker_luis", "mod_marcus", "whale_wendy",
];

// Emote tags mirror Kick's real inline syntax so parsers get exercised offline.
const CHAT_LINES = [
  "LETS GOOO 🔥", "no way that just happened", "W streamer", "POGGERS",
  "clip it!!", "that was insane", "gg gg gg", "first time here, this rules",
  "LMAOOO 😂", "HYPE HYPE HYPE", "sheeesh", "actual cinema", "cracked aim",
  "[emote:37226:KEKW] [emote:37226:KEKW]", "gg [emote:37221:EZ] wp",
  "💀💀💀", "🚂🚂 hype train", "W 🐐", "[emote:1730752:pepeD] vibes",
  "FIRE GANG 🔥", "team water 💧 lets go", "🔥🔥🔥", "💧 wave check",
];

const GIFT_NAMES = ["Hype Rocket", "Golden Kappa", "Confetti Cannon", "Mega Horn"];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const user = () => {
  const username = pick(USERNAMES);
  return { user_id: Math.floor(Math.random() * 90_000) + 1000, username };
};

const PAYLOAD_MAKERS: Record<string, () => unknown> = {
  "chat.message.sent": () => ({
    message_id: randomUUID(),
    content: pick(CHAT_LINES),
    sender: { ...user(), identity: { username_color: "#53fc18" } },
  }),
  "channel.followed": () => ({ follower: user() }),
  "channel.subscription.new": () => ({
    subscriber: user(),
    duration: Math.floor(Math.random() * 12) + 1,
  }),
  "channel.subscription.gifts": () => ({
    gifter: user(),
    giftees: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, user),
  }),
  "kicks.gifted": () => ({
    gifter: user(),
    gift: {
      amount: pick([25, 50, 100, 250, 500]),
      name: pick(GIFT_NAMES),
      type: "KICKS",
      tier: "large",
      message: "take my kicks",
    },
  }),
  "livestream.status.updated": () => ({
    is_live: Math.random() > 0.3,
    title: "Fake stream title",
  }),
};

// Chat-heavy so bursts read like a real chat spike with hype moments mixed in.
const BURST_POOL = [
  ...Array(6).fill("chat.message.sent"),
  "channel.followed",
  "channel.followed",
  "channel.subscription.new",
  "kicks.gifted",
];

function publish(type: string) {
  eventBus.publish({
    id: randomUUID(),
    type: `fake:${type}`,
    receivedAt: new Date().toISOString(),
    payload: PAYLOAD_MAKERS[type]?.() ?? { note: "synthetic event" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));

  if (body?.burst) {
    const count = Math.min(Number(body.burst) || 15, 50);
    for (let i = 0; i < count; i++) {
      setTimeout(() => publish(pick(BURST_POOL)), i * 180);
    }
    return Response.json({ ok: true, burst: count });
  }

  const type = typeof body?.type === "string" ? body.type : "chat.message.sent";
  publish(type);
  return Response.json({ ok: true });
}
