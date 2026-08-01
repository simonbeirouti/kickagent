import { listBets, listPredictions, oddsFor } from "@/lib/assistant/bets-store";
import { demoStatus } from "@/lib/assistant/demo-script";
import { ensureAssistantRuntime } from "@/lib/assistant/runtime";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const agent = ensureAssistantRuntime();
  return Response.json({
    hype: {
      score: Math.round(agent.score),
      velocity: agent.velocity,
      breakdown: agent.breakdown,
      trend: agent.trend,
      ready: agent.ready,
      topics: agent.topTopics,
    },
    predictions: listPredictions().map((p) => ({ ...p, odds: oddsFor(p) })),
    bets: listBets(),
    highlights: agent.highlights,
    demo: demoStatus(),
  });
}
