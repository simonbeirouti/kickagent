import { query } from "@/lib/db";
import { start } from "workflow/api";
import { getKickChannel } from "@/lib/kick/oauth";
import {
  findConnectionById,
  findOwnerConnection,
  refreshKickChannelIfStale,
  upgradeSuggestionWorkflow,
} from "@/lib/kick/repository";
import {
  DEFAULT_OVERLAY_LAYOUT,
  parseOverlayLayout,
  parseScreenLayouts,
} from "@/lib/overlay-layout";
import {
  connectionIdFromRequest,
  overlayAccessFromRequest,
  statelessKickMode,
  statelessSessionFromRequest,
} from "@/lib/session";
import { SUGGESTION_WORKFLOW_VERSION } from "@/lib/suggestion-cadence";
import { kickSuggestionWorkflow } from "@/workflows/kick-suggestions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MessageRow extends Record<string, unknown> {
  readonly content: string;
  readonly created_at: string;
  readonly message_id: string;
  readonly sender_username: string;
}

interface AnalysisRow extends Record<string, unknown> {
  readonly basis: "chat" | "stream_context" | null;
  readonly generated_at: string | null;
  readonly hype_score: number | null;
  readonly status: "processing" | "complete" | "failed";
  readonly suggestion: string | null;
  readonly summary: string | null;
  readonly topics: unknown;
  readonly window_start: string;
}

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const publicOverlay = requestUrl.searchParams.get("public") === "overlay";
  const syncKick = requestUrl.searchParams.get("sync") === "kick";
  const overlayAccess = overlayAccessFromRequest(request);
  // The public overlay is backed by the persisted owner connection and must not
  // depend on the viewer's session cookie, even when stateless dashboard mode is
  // enabled for local sign-in/previewing.
  if (statelessKickMode() && !publicOverlay) {
    const session =
      overlayAccess?.kind === "stateless"
        ? overlayAccess.session
        : statelessSessionFromRequest(request);
    if (!session) {
      return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
    }
    let channel = session.channel;
    if (syncKick) {
      try {
        channel = await getKickChannel(session.accessToken);
      } catch (error) {
        console.error("Failed to refresh stateless Kick channel state", error);
      }
    }
    return Response.json(
      {
        authenticated: true,
        channel: {
          category: channel.categoryName ?? null,
          displayName: session.profile.name,
          profilePicture: session.profile.profilePicture ?? null,
          slug: channel.slug,
          streamTitle: channel.streamTitle ?? null,
        },
        connected: true,
        hypeScore: 0,
        ingestionEnabled: false,
        live: channel.isLive,
        layout:
          overlayAccess?.kind === "stateless" ? overlayAccess.layout : DEFAULT_OVERLAY_LAYOUT,
        messages: [],
        screenLayouts: {
          public: overlayAccess?.kind === "stateless"
            ? overlayAccess.layout
            : DEFAULT_OVERLAY_LAYOUT,
        },
        suggestion: null,
        summary: null,
        updatedAt: new Date().toISOString(),
      },
      { headers: noStoreHeaders() },
    );
  }
  const publicConnection = publicOverlay ? await findOwnerConnection() : undefined;
  const connectionId = publicConnection
    ? publicConnection.id
    : overlayAccess?.kind === "connection"
      ? overlayAccess.connectionId
      : await connectionIdFromRequest(request);
  if (!connectionId) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
  }
  let connection = publicConnection ?? (await findConnectionById(connectionId));
  if (!connection || !connection.active) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
  }
  if (connection.suggestion_workflow_version < SUGGESTION_WORKFLOW_VERSION) {
    const upgradedConnection = await upgradeSuggestionWorkflow(connection.id);
    if (upgradedConnection) {
      connection = upgradedConnection;
      await start(kickSuggestionWorkflow, [connection.id, connection.workflow_generation]);
      console.info("[suggestion:workflow] upgraded", {
        connectionId: connection.id,
        generation: connection.workflow_generation,
        version: connection.suggestion_workflow_version,
      });
    }
  }
  if (
    overlayAccess?.kind === "connection" &&
    overlayAccess.workflowGeneration !== connection.workflow_generation
  ) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
  }
  if (syncKick) {
    try {
      connection = await refreshKickChannelIfStale(connection);
    } catch (error) {
      console.error("Failed to refresh Kick channel state", error);
    }
  }
  const [messageRows, completedRows, latestRows] = await Promise.all([
    query<MessageRow>(
      `SELECT message_id, sender_username, content, created_at
       FROM chat_messages WHERE connection_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [connectionId],
    ),
    query<AnalysisRow>(
      `SELECT window_start, status, suggestion, basis, summary, topics, hype_score, generated_at
       FROM analysis_windows
       WHERE connection_id = $1 AND status = 'complete'
       ORDER BY window_start DESC LIMIT 1`,
      [connectionId],
    ),
    query<AnalysisRow>(
      `SELECT window_start, status, suggestion, basis, summary, topics, hype_score, generated_at
       FROM analysis_windows
       WHERE connection_id = $1
       ORDER BY window_start DESC LIMIT 1`,
      [connectionId],
    ),
  ]);
  const suggestion = completedRows[0];
  const latest = latestRows[0];
  const generatedAt = suggestion?.generated_at ? new Date(suggestion.generated_at).getTime() : 0;
  const stale =
    connection.is_live &&
    (!suggestion || Date.now() - generatedAt > 90_000 || latest?.status === "failed");
  return Response.json(
    {
      authenticated: true,
      channel: {
        category: connection.category_name,
        displayName: connection.display_name,
        profilePicture: connection.profile_picture,
        slug: connection.channel_slug,
        streamTitle: connection.stream_title,
      },
      connected: connection.active,
      hypeScore: suggestion?.hype_score ?? 0,
      ingestionEnabled: true,
      live: connection.is_live,
      layout: parseOverlayLayout(connection.overlay_layout),
      messages: messageRows.reverse().map((message) => ({
        content: message.content,
        createdAt: message.created_at,
        id: message.message_id,
        username: message.sender_username,
      })),
      screenLayouts: parseScreenLayouts(
        connection.screen_layouts,
        parseOverlayLayout(connection.overlay_layout),
      ),
      suggestion: suggestion
        ? {
            basis: suggestion.basis,
            generatedAt: suggestion.generated_at,
            stale,
            text: suggestion.suggestion,
          }
        : null,
      summary: suggestion?.summary
        ? {
            generatedAt: suggestion.generated_at,
            stale,
            text: suggestion.summary,
            topics: parseTopics(suggestion.topics),
          }
        : null,
      updatedAt: new Date().toISOString(),
    },
    { headers: noStoreHeaders() },
  );
}

function parseTopics(value: unknown): { label: string; percentage: number }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((topic) => {
    if (!topic || typeof topic !== "object") return [];
    const candidate = topic as Record<string, unknown>;
    if (typeof candidate.label !== "string" || typeof candidate.percentage !== "number") return [];
    return [{
      label: candidate.label.slice(0, 48),
      percentage: Math.max(0, Math.min(100, Math.round(candidate.percentage))),
    }];
  }).slice(0, 3);
}

function noStoreHeaders(): HeadersInit {
  return {
    "cache-control": "private, no-store, max-age=0",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
  };
}
