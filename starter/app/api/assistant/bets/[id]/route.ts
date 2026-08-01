import { advanceBet } from "@/lib/assistant/bets-store";
import { ensureAssistantRuntime } from "@/lib/assistant/runtime";

const VALIDATION_PAUSE_MS = 1_800;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  ensureAssistantRuntime();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "accept" && action !== "decline" && action !== "validate") {
    return Response.json({ error: "action must be accept, decline or validate" }, { status: 400 });
  }
  try {
    if (action === "validate") {
      // Mock multimodal validation: watching → validated → paid with pauses.
      const bet = advanceBet(id, "watch");
      setTimeout(() => {
        try {
          advanceBet(id, "validate");
          setTimeout(() => advanceBet(id, "pay"), VALIDATION_PAUSE_MS);
        } catch (e) {
          console.error("bet validation sequence failed", e);
        }
      }, VALIDATION_PAUSE_MS);
      return Response.json(bet);
    }
    return Response.json(advanceBet(id, action));
  } catch (e) {
    const message = e instanceof Error ? e.message : "bet action failed";
    const status = /unknown/.test(message) ? 404 : 409;
    return Response.json({ error: message }, { status });
  }
}
