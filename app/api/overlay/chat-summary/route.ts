import { listChatSummaryWindows } from "@/lib/kick/chat-summary-store";
import { findConnectionById } from "@/lib/kick/repository";
import {
  connectionIdFromRequest,
  overlayAccessFromRequest,
  statelessKickMode,
  statelessSessionFromRequest,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Three ticks behind the 20s cadence, same "N windows behind" heuristic
// app/api/overlay/state/route.ts uses for the 30s suggestion (90s = 3 * 30s).
const STALE_MS = 60_000;

export async function GET(request: Request): Promise<Response> {
  const overlayAccess = overlayAccessFromRequest(request);
  if (statelessKickMode()) {
    const session =
      overlayAccess?.kind === "stateless" ? overlayAccess.session : statelessSessionFromRequest(request);
    if (!session) {
      return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
    }
    // Stateless mode has no chat ingestion to summarize (see README), so this
    // ships sample data — mirrors the sample hype score in state/route.ts —
    // gated by ingestionEnabled=false so the widget can label it as preview.
    return Response.json(
      {
        authenticated: true,
        ingestionEnabled: false,
        summary: {
          generatedAt: new Date().toISOString(),
          interest: "medium",
          messageCount: 0,
          purpose: "Preview data — connect Kick to summarize real chat.",
          requests: [],
          stale: false,
          suggestions: ["Ask chat what they'd like to see next."],
          summary: "Sample preview data. No live chat is summarized in stateless mode.",
          tone: "neutral",
          windowEnd: new Date().toISOString(),
          windowStart: new Date().toISOString(),
        },
      },
      { headers: noStoreHeaders() },
    );
  }

  const connectionId =
    overlayAccess?.kind === "connection"
      ? overlayAccess.connectionId
      : await connectionIdFromRequest(request);
  if (!connectionId) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
  }
  const connection = await findConnectionById(connectionId);
  if (!connection || !connection.active) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
  }
  if (
    overlayAccess?.kind === "connection" &&
    overlayAccess.workflowGeneration !== connection.workflow_generation
  ) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
  }

  const windows = await listChatSummaryWindows(connectionId);
  const latest = windows[windows.length - 1];
  const completed = [...windows].reverse().find((record) => record.status === "complete");
  const generatedAtMs =
    completed?.status === "complete" ? new Date(completed.generatedAt).getTime() : 0;
  const stale =
    connection.is_live &&
    (!completed || Date.now() - generatedAtMs > STALE_MS || latest?.status === "failed");

  return Response.json(
    {
      authenticated: true,
      ingestionEnabled: true,
      summary:
        completed?.status === "complete"
          ? {
              generatedAt: completed.generatedAt,
              interest: completed.interest,
              messageCount: completed.messageCount,
              purpose: completed.purpose,
              requests: completed.requests,
              stale,
              suggestions: completed.suggestions,
              summary: completed.summary,
              tone: completed.tone,
              windowEnd: completed.windowEnd,
              windowStart: completed.windowStart,
            }
          : null,
    },
    { headers: noStoreHeaders() },
  );
}

function noStoreHeaders(): HeadersInit {
  return {
    "cache-control": "private, no-store, max-age=0",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
  };
}
