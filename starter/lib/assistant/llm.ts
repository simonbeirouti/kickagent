import Anthropic from "@anthropic-ai/sdk";

/**
 * LLM touches for the assistant: rewrite heuristic coach tips / summary lines
 * and caption memes. Every call degrades to the heuristic text when no
 * ANTHROPIC_API_KEY is set or the call fails, so demos never depend on network.
 */

export type AssistantText = { text: string; source: "ai" | "heuristic" };

const TEXT_SCHEMA = {
  type: "object" as const,
  properties: {
    text: { type: "string" as const, description: "The rewritten line, under 15 words" },
  },
  required: ["text"],
  additionalProperties: false,
};

async function polish(system: string, prompt: string, fallback: string): Promise<AssistantText> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { text: fallback, source: "heuristic" };
  }
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 256,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: TEXT_SCHEMA },
      },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      return { text: fallback, source: "heuristic" };
    }
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    return { text: JSON.parse(text).text, source: "ai" };
  } catch (e) {
    console.error("assistant llm: falling back to heuristic", e);
    return { text: fallback, source: "heuristic" };
  }
}

export function coachTip(
  heuristic: string,
  ctx: { score: number; velocity: number },
): Promise<AssistantText> {
  return polish(
    "You are Kick-Ass(istant), an AI coach whispering real-time tips into a live KICK streamer's glasses. Punchy, specific, encouraging. One short sentence, an emoji is welcome.",
    `Hype score ${Math.round(ctx.score)}/100, chat velocity ${ctx.velocity} msgs/min. Rewrite this tip in your voice: ${heuristic}`,
    heuristic,
  );
}

export function summaryLine(heuristic: string): Promise<AssistantText> {
  return polish(
    "You write one-line live-summary entries so stream viewers never miss a moment. Compress to a punchy timeline line, keep usernames and numbers exact.",
    `Rewrite as a timeline entry: ${heuristic}`,
    heuristic,
  );
}

export function memeCaption(token: string): Promise<AssistantText> {
  return polish(
    "You caption meme moments on a live KICK stream overlay. Hype, short, fun. Reference the spammed token exactly.",
    `Chat is flooding the word "${token}". Caption the meme drop.`,
    `Chat is spamming "${token}"!`,
  );
}
