import { oddsFor, placeWager } from "@/lib/assistant/bets-store";
import { ensureAssistantRuntime } from "@/lib/assistant/runtime";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  ensureAssistantRuntime();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const user = typeof body?.user === "string" && body.user.trim() ? body.user.trim() : "viewer";
  const side = body?.side;
  const amount = Number(body?.amount);
  if ((side !== "yes" && side !== "no") || !(amount > 0)) {
    return Response.json({ error: "side must be yes/no and amount positive" }, { status: 400 });
  }
  try {
    const p = placeWager(id, user, side, amount, Date.now());
    return Response.json({ ...p, odds: oddsFor(p) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "wager failed";
    const status = /unknown/.test(message) ? 404 : 409;
    return Response.json({ error: message }, { status });
  }
}
