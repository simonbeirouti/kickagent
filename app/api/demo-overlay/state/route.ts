import { getDemoOverlayState, setDemoOverlayState } from "@/lib/demo-overlay-server-state";
import { parseOverlayLayout } from "@/lib/overlay-layout";
import type { OverlayState } from "@/lib/overlay-state";

export const runtime = "nodejs";

export function GET(): Response {
  return Response.json(getDemoOverlayState(), { headers: noStoreHeaders() });
}

export async function PUT(request: Request): Promise<Response> {
  const body = await request.json().catch(() => undefined) as Partial<OverlayState> | undefined;
  if (!body || body.authenticated !== true || !body.channel || !Array.isArray(body.messages)) {
    return Response.json({ error: "Invalid demo overlay state." }, { status: 400 });
  }

  const current = getDemoOverlayState();
  const state = setDemoOverlayState({
    ...current,
    ...body,
    layout: parseOverlayLayout(body.layout),
    screenLayouts: body.screenLayouts
      ? {
          glasses: body.screenLayouts.glasses ? parseOverlayLayout(body.screenLayouts.glasses) : current.screenLayouts?.glasses,
          phone: body.screenLayouts.phone ? parseOverlayLayout(body.screenLayouts.phone) : current.screenLayouts?.phone,
          public: body.screenLayouts.public ? parseOverlayLayout(body.screenLayouts.public) : current.screenLayouts?.public,
        }
      : current.screenLayouts,
    messages: body.messages.slice(0, 5),
  });
  return Response.json(state, { headers: noStoreHeaders() });
}

function noStoreHeaders(): HeadersInit {
  return { "cache-control": "no-store, max-age=0" };
}
