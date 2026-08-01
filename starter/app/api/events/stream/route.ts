import { eventBus, KickEvent } from "@/lib/event-bus";
import { ensureAssistantRuntime } from "@/lib/assistant/runtime";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(): Promise<Response> {
  // Every demo page rides this stream, so opening it boots the hype brain —
  // assistant.hype/highlight/coach events flow without touching an
  // assistant route first.
  ensureAssistantRuntime();
  const encoder = new TextEncoder();
  let listener: ((e: KickEvent) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: KickEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      for (const e of eventBus.buffer) send(e);

      listener = send;
      eventBus.on("event", listener);
      heartbeat = setInterval(
        () => controller.enqueue(encoder.encode(": ping\n\n")),
        HEARTBEAT_MS
      );
    },
    cancel() {
      if (listener) eventBus.off("event", listener);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
