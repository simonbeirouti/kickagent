import { eventBus } from "@/lib/event-bus";
import { getKickPublicKey } from "@/lib/kick-api";
import { verifyKickSignature } from "@/lib/verify-signature";

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const messageId = req.headers.get("kick-event-message-id") ?? "";
  const timestamp = req.headers.get("kick-event-message-timestamp") ?? "";
  const signature = req.headers.get("kick-event-signature") ?? "";
  const type = req.headers.get("kick-event-type") ?? "unknown";

  const publicKey = await getKickPublicKey();
  if (!verifyKickSignature(publicKey, messageId, timestamp, rawBody, signature)) {
    console.warn("Rejected webhook: bad signature", { messageId, type });
    return new Response("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid JSON body", { status: 400 });
  }

  eventBus.publish({ id: messageId, type, receivedAt: new Date().toISOString(), payload });
  return new Response("ok");
}
