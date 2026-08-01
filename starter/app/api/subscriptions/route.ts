import { listSubscriptions, subscribeToChannel, deleteSubscriptions } from "@/lib/kick-api";
import { kickErrorResponse } from "@/lib/http";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listSubscriptions());
  } catch (e) {
    return kickErrorResponse(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const broadcasterUserId = Number(body?.broadcaster_user_id);
  if (!Number.isInteger(broadcasterUserId) || broadcasterUserId <= 0) {
    return Response.json({ error: "broadcaster_user_id (positive integer) required" }, { status: 400 });
  }
  try {
    await subscribeToChannel(broadcasterUserId);
    return Response.json({ ok: true });
  } catch (e) {
    return kickErrorResponse(e);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return Response.json({ error: "ids (non-empty string array) required" }, { status: 400 });
  }
  try {
    await deleteSubscriptions(ids);
    return Response.json({ ok: true });
  } catch (e) {
    return kickErrorResponse(e);
  }
}
