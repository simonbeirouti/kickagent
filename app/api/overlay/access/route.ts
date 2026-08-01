import { appUrl } from "@/lib/env";
import { findConnectionById } from "@/lib/kick/repository";
import { DEFAULT_OVERLAY_LAYOUT, overlayLayoutSchema } from "@/lib/overlay-layout";
import {
  connectionIdFromRequest,
  createOverlayAccessToken,
  statelessKickMode,
  statelessSessionFromRequest,
} from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!hasValidOrigin(request)) {
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  }

  let token: string;
  if (statelessKickMode()) {
    const session = statelessSessionFromRequest(request);
    if (!session) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const layout = overlayLayoutSchema.safeParse(body.layout);
    token = createOverlayAccessToken({
      layout: layout.success ? layout.data : DEFAULT_OVERLAY_LAYOUT,
      session,
    });
  } else {
    const connectionId = await connectionIdFromRequest(request);
    if (!connectionId) return unauthorized();
    const connection = await findConnectionById(connectionId);
    if (!connection?.active) return unauthorized();
    token = createOverlayAccessToken({
      connectionId,
      workflowGeneration: connection.workflow_generation,
    });
  }

  return Response.json(
    { url: `${appUrl()}/overlay/${encodeURIComponent(token)}` },
    { headers: noStoreHeaders() },
  );
}

function hasValidOrigin(request: Request): boolean {
  return request.headers.get("origin") === new URL(appUrl()).origin;
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized." }, { headers: noStoreHeaders(), status: 401 });
}

function noStoreHeaders(): HeadersInit {
  return { "cache-control": "private, no-store, max-age=0" };
}
