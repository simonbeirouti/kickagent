import { createBet } from "@/lib/assistant/bets-store";
import { ensureAssistantRuntime } from "@/lib/assistant/runtime";

export async function POST(req: Request): Promise<Response> {
  ensureAssistantRuntime();
  const body = await req.json().catch(() => ({}));
  const user = typeof body?.user === "string" ? body.user.trim() : "";
  const condition = typeof body?.condition === "string" ? body.condition.trim().slice(0, 200) : "";
  const wager = Number(body?.wager);
  if (!user || !condition || !(wager > 0)) {
    return Response.json({ error: "user, condition and positive wager required" }, { status: 400 });
  }
  const minutes = Number(body?.durationMinutes) || 45;
  const bet = createBet(user, wager, condition, minutes * 60_000, Date.now());
  return Response.json(bet);
}
