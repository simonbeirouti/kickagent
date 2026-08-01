import { createPrediction, oddsFor } from "@/lib/assistant/bets-store";
import { ensureAssistantRuntime } from "@/lib/assistant/runtime";

export async function POST(req: Request): Promise<Response> {
  ensureAssistantRuntime();
  const body = await req.json().catch(() => ({}));
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 200) : "";
  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  const minutes = Number(body?.durationMinutes) || 60;
  const p = createPrediction(question, minutes * 60_000, Date.now());
  return Response.json({ ...p, odds: oddsFor(p) });
}
