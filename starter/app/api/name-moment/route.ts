import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const NAME_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const, description: "Punchy 2-5 word name for the stream moment, like a highlight-reel caption" },
    tagline: { type: "string" as const, description: "One short sentence hyping the moment" },
  },
  required: ["title", "tagline"],
  additionalProperties: false,
};

// Works with no API key so the demo never depends on network/credentials.
const FALLBACK_TITLES: Record<string, string[]> = {
  "kicks.gifted": ["The KICKs Rain", "Whale Alert", "Rocket Shower"],
  "channel.subscription.gifts": ["Gift Sub Avalanche", "The Generosity Wave"],
  "channel.subscription.new": ["Sub Train Departure", "New Blood Surge"],
  "channel.followed": ["Follow Flood", "The Recruitment Drive"],
  "chat.message.sent": ["Emote Tsunami", "Chat Eruption", "The Spam Storm"],
};

function fallbackName(summary: string, topKind: string) {
  const pool = FALLBACK_TITLES[topKind] ?? ["The Hype Spike"];
  const title = pool[Math.floor(Math.random() * pool.length)];
  return { title, tagline: `Chat went off — ${summary}`, source: "heuristic" as const };
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const summary = typeof body?.summary === "string" ? body.summary.slice(0, 500) : "";
  const topKind = typeof body?.topKind === "string" ? body.topKind : "chat.message.sent";

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(fallbackName(summary, topKind));
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 256,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: NAME_SCHEMA },
      },
      system:
        "You name hype moments on a live KICK stream, like naming clips for a highlight reel. Be punchy, fun, and specific to what happened. Never use quotes in the title.",
      messages: [{ role: "user", content: `Name this stream moment: ${summary}` }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json(fallbackName(summary, topKind));
    }
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text);
    return Response.json({ title: parsed.title, tagline: parsed.tagline, source: "ai" });
  } catch (e) {
    console.error("name-moment: Claude call failed, using fallback", e);
    return Response.json(fallbackName(summary, topKind));
  }
}
