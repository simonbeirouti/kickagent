import { query } from "@/lib/db";
import { findConnectionById } from "@/lib/kick/repository";
import {
  connectionIdFromRequest,
  statelessKickMode,
  statelessSessionFromRequest,
} from "@/lib/session";

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
  readonly status: "processing" | "complete" | "failed";
  readonly suggestion: string | null;
  readonly window_start: string;
}

export async function GET(request: Request): Promise<Response> {
  if (statelessKickMode()) {
    const session = statelessSessionFromRequest(request);
    if (!session) {
      return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
    }
    return Response.json(
      {
        authenticated: true,
        channel: {
          category: session.channel.categoryName ?? null,
          displayName: session.profile.name,
          profilePicture: session.profile.profilePicture ?? null,
          slug: session.channel.slug,
          streamTitle: session.channel.streamTitle ?? null,
        },
        connected: true,
        hypeScore: 72,
        live: session.channel.isLive,
        messages: [],
        suggestion: null,
        updatedAt: new Date().toISOString(),
      },
      { headers: noStoreHeaders() },
    );
  }
  const connectionId = await connectionIdFromRequest(request);
  if (!connectionId) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
  }
  const connection = await findConnectionById(connectionId);
  if (!connection || !connection.active) {
    return Response.json({ authenticated: false }, { headers: noStoreHeaders(), status: 401 });
  }
  const [messageRows, completedRows, latestRows] = await Promise.all([
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
      hypeScore: 72,
      live: connection.is_live,
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
  return { "cache-control": "private, no-store, max-age=0" };
}
