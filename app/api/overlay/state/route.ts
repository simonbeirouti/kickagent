import { query } from "@/lib/db";
import { computeHypeSnapshot, type HypeChatRow } from "@/lib/hype";
import { getKickChannel } from "@/lib/kick/oauth";
import { findConnectionById, refreshKickChannelIfStale } from "@/lib/kick/repository";
import { DEFAULT_OVERLAY_LAYOUT, parseOverlayLayout } from "@/lib/overlay-layout";
import {
  connectionIdFromRequest,
  overlayAccessFromRequest,
  statelessKickMode,
  statelessSessionFromRequest,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Same trailing lookback workflows/kick-suggestions.ts replays per tick: must
// comfortably exceed HypeEngine's 45s warm-up so `ready` means a locked baseline.
const HYPE_LOOKBACK_MS = 3 * 60_000;

interface MessageRow extends Record<string, unknown> {
  readonly content: string;
  readonly created_at: string;
  readonly message_id: string;
  readonly sender_username: string;
}

interface AnalysisRow extends Record<string, unknown> {
  readonly basis: "chat" | "stream_context" | null;
  readonly generated_at: string | null;
  readonly status: "processing" | "complete" | "failed";
  readonly suggestion: string | null;
  readonly window_start: string;
}

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const syncKick = requestUrl.searchParams.get("sync") === "kick";
  const overlayAccess = overlayAccessFromRequest(request);
  if (statelessKickMode()) {
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
        // Stateless mode stores no chat, so the hype engine has no input to
        // replay — report a cold engine instead of a made-up score.
        hypeReady: false,
        hypeScore: 0,
        hypeTrend: "steady",
        ingestionEnabled: false,
        live: channel.isLive,
        layout:
          overlayAccess?.kind === "stateless" ? overlayAccess.layout : DEFAULT_OVERLAY_LAYOUT,
        messages: [],
        suggestion: null,
        updatedAt: new Date().toISOString(),
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
  let connection = await findConnectionById(connectionId);
  if (!connection || !connection.active) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
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
  const asOf = Date.now();
  const [messageRows, completedRows, latestRows, hypeRows] = await Promise.all([
    query<MessageRow>(
      `SELECT message_id, sender_username, content, created_at
       FROM chat_messages WHERE connection_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [connectionId],
    ),
    query<AnalysisRow>(
      `SELECT window_start, status, suggestion, basis, generated_at
       FROM analysis_windows
       WHERE connection_id = $1 AND status = 'complete'
       ORDER BY window_start DESC LIMIT 1`,
      [connectionId],
    ),
    query<AnalysisRow>(
      `SELECT window_start, status, suggestion, basis, generated_at
       FROM analysis_windows
       WHERE connection_id = $1
       ORDER BY window_start DESC LIMIT 1`,
      [connectionId],
    ),
    query<HypeChatRow>(
      `SELECT message_id, sender_user_id::text, sender_username, content, created_at
       FROM chat_messages
       WHERE connection_id = $1 AND created_at >= $2
       ORDER BY created_at ASC`,
      [connectionId, new Date(asOf - HYPE_LOOKBACK_MS).toISOString()],
    ),
  ]);
  const hype = computeHypeSnapshot(hypeRows, asOf);
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
      hypeReady: hype.ready,
      hypeScore: hype.score,
      hypeTrend: hype.trend,
      ingestionEnabled: true,
      live: connection.is_live,
      layout: parseOverlayLayout(connection.overlay_layout),
      messages: messageRows.reverse().map((message) => ({
        content: message.content,
        createdAt: message.created_at,
        id: message.message_id,
        username: message.sender_username,
      })),
      suggestion: suggestion
        ? {
            basis: suggestion.basis,
            generatedAt: suggestion.generated_at,
            stale,
            text: suggestion.suggestion,
          }
        : null,
      updatedAt: new Date().toISOString(),
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
