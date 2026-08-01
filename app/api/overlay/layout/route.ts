import { appUrl } from "@/lib/env";
import { updateOverlayLayout } from "@/lib/kick/repository";
import { managedScreenSchema, overlayLayoutSchema } from "@/lib/overlay-layout";
import { connectionIdFromRequest, statelessKickMode } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

const updateLayoutSchema = z.object({
  layout: overlayLayoutSchema,
  screen: managedScreenSchema,
});

export async function PUT(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== new URL(appUrl()).origin) {
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  }
  const parsed = updateLayoutSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return Response.json({ error: "Invalid overlay layout." }, { status: 400 });
  }
  if (!statelessKickMode()) {
    const connectionId = await connectionIdFromRequest(request);
    if (!connectionId) return Response.json({ error: "Unauthorized." }, { status: 401 });
    await updateOverlayLayout(connectionId, parsed.data.screen, parsed.data.layout);
  }
  return Response.json(
    { ok: true },
    { headers: { "cache-control": "private, no-store, max-age=0" } },
  );
}
