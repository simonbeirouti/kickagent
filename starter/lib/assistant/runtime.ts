import { eventBus, type KickEvent } from "@/lib/event-bus";
import { AssistantAgent } from "@/lib/assistant/agent";
import { createPrediction, placeWager, recordBetImpact } from "@/lib/assistant/bets-store";
import { coachTip, memeCaption, summaryLine } from "@/lib/assistant/llm";
import { publishAssistant } from "@/lib/assistant/publish";

type Runtime = { agent: AssistantAgent };

declare global {
  // survives Next.js dev-mode module reloads
  var __assistantRuntime: Runtime | undefined;
}

/** Coach/summary/meme emissions get an async LLM polish before hitting the bus. */
function publishPolished(agent: () => AssistantAgent, type: string, payload: unknown) {
  const p = payload as Record<string, any>;
  switch (type) {
    case "assistant.coach":
      void coachTip(p.text, { score: agent().score, velocity: agent().velocity }).then((r) =>
        publishAssistant(type, { ...p, text: r.text, source: r.source }),
      );
      return;
    case "assistant.summary":
      void summaryLine(p.text).then((r) =>
        publishAssistant(type, { ...p, text: r.text, source: r.source }),
      );
      return;
    case "assistant.meme":
      void memeCaption(p.token).then((r) =>
        publishAssistant(type, { ...p, caption: r.text, source: r.source }),
      );
      return;
    case "assistant.bet.impact": {
      // Engine verdict → stored on the bet → full bet re-published so every
      // client upserts the card with its up/flat/down chip.
      const bet = recordBetImpact(p.id, p.impact);
      if (bet) publishAssistant(type, bet);
      return;
    }
    default:
      publishAssistant(type, payload);
  }
}

export function ensureAssistantRuntime(): AssistantAgent {
  if (globalThis.__assistantRuntime) return globalThis.__assistantRuntime.agent;

  const agent: AssistantAgent = new AssistantAgent((type, payload) =>
    publishPolished(() => agent, type, payload),
  );

  // Seed the long-running prediction before the agent listens, so boot wagers
  // don't inflate the hype score.
  const now = Date.now();
  const seeded = createPrediction("Will Neon hit 13,000 trophies this stream?", 2.2 * 3_600_000, now);
  placeWager(seeded.id, "HypeKing", "yes", 750, now);
  placeWager(seeded.id, "clutch_carla", "yes", 500, now);
  placeWager(seeded.id, "doubter_dan", "no", 480, now);

  eventBus.on("event", (e: KickEvent) => {
    agent.ingest(e.type.replace(/^fake:/, ""), e.payload, Date.now());
  });
  setInterval(() => agent.tick(Date.now()), 1000).unref?.();

  globalThis.__assistantRuntime = { agent };
  return agent;
}
