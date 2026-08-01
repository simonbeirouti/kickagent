import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/security";
import type { KickChannel, KickProfile } from "@/lib/kick/oauth";
import type { KickToken } from "@/lib/kick/types";
import type { ManagedScreen, OverlayLayout } from "@/lib/overlay-layout";

export interface ConnectionRecord extends Record<string, unknown> {
  readonly access_token_encrypted: string;
  readonly active: boolean;
  readonly category_id: string | null;
  readonly category_name: string | null;
  readonly channel_slug: string;
  readonly display_name: string;
  readonly email: string | null;
  readonly id: string;
  readonly is_live: boolean;
  readonly kick_user_id: string;
  readonly overlay_layout: unknown;
  readonly profile_picture: string | null;
  readonly refresh_token_encrypted: string;
  readonly screen_layouts: unknown;
  readonly scopes: string[];
  readonly stream_title: string | null;
  readonly subscription_ids: string[];
  readonly token_expires_at: string;
  readonly workflow_generation: number;
  readonly suggestion_message_count: number;
  readonly suggestion_next_at: string;
  readonly suggestion_window_start: string;
}

export async function updateOverlayLayout(
  connectionId: string,
  screen: ManagedScreen,
  layout: OverlayLayout,
): Promise<void> {
  await query(
    `UPDATE kick_connections
     SET screen_layouts = jsonb_set(screen_layouts, ARRAY[$2], $3::text::jsonb, true),
         overlay_layout = CASE WHEN $2 = 'public' THEN $3::text::jsonb ELSE overlay_layout END,
         updated_at = now()
     WHERE id = $1 AND active = true`,
    [connectionId, screen, JSON.stringify(layout)],
  );
}

export async function findConnectionById(id: string): Promise<ConnectionRecord | undefined> {
  const rows = await query<ConnectionRecord>("SELECT * FROM kick_connections WHERE id = $1", [id]);
  return rows[0];
}

export async function findConnectionByKickUserId(
  kickUserId: string,
): Promise<ConnectionRecord | undefined> {
  const rows = await query<ConnectionRecord>(
    "SELECT * FROM kick_connections WHERE kick_user_id = $1",
    [kickUserId],
  );
  return rows[0];
}

export async function findOwnerConnection(): Promise<ConnectionRecord | undefined> {
  const rows = await query<ConnectionRecord>(
    "SELECT * FROM kick_connections ORDER BY created_at ASC LIMIT 1",
  );
  return rows[0];
}

export async function upsertKickConnection(input: {
  readonly channel: KickChannel;
  readonly profile: KickProfile;
  readonly subscriptionIds: readonly string[];
  readonly token: KickToken;
}): Promise<ConnectionRecord> {
  const existing = await findConnectionByKickUserId(input.profile.userId);
  const id = existing?.id ?? randomUUID();
  const nextGeneration = (existing?.workflow_generation ?? 0) + 1;
  const expiresAt = new Date(Date.now() + input.token.expires_in * 1000).toISOString();
  const rows = await query<ConnectionRecord>(
    `INSERT INTO kick_connections (
      id, kick_user_id, email, display_name, profile_picture, channel_slug,
      access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes,
      subscription_ids, active, is_live, stream_title, category_name, category_id,
      workflow_generation, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::text[], true,
      $12, $13, $14, $15, $16, now()
    )
    ON CONFLICT (kick_user_id) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      profile_picture = EXCLUDED.profile_picture,
      channel_slug = EXCLUDED.channel_slug,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      token_expires_at = EXCLUDED.token_expires_at,
      scopes = EXCLUDED.scopes,
      subscription_ids = EXCLUDED.subscription_ids,
      active = true,
      is_live = EXCLUDED.is_live,
      stream_title = EXCLUDED.stream_title,
      category_name = EXCLUDED.category_name,
      category_id = EXCLUDED.category_id,
      token_refresh_started_at = NULL,
      workflow_generation = EXCLUDED.workflow_generation,
      suggestion_message_count = 0,
      suggestion_next_at = now() + interval '30 seconds',
      suggestion_window_start = now(),
      updated_at = now()
    RETURNING *`,
    [
      id,
      input.profile.userId,
      input.profile.email ?? null,
      input.profile.name,
      input.profile.profilePicture ?? null,
      input.channel.slug,
      encryptSecret(input.token.access_token),
      encryptSecret(input.token.refresh_token),
      expiresAt,
      input.token.scope.split(/\s+/u).filter(Boolean),
      [...input.subscriptionIds],
      input.channel.isLive,
      input.channel.streamTitle ?? null,
      input.channel.categoryName ?? null,
      input.channel.categoryId ?? null,
      nextGeneration,
    ],
  );
  return rows[0];
}

export async function validKickAccessToken(connectionId: string): Promise<string> {
  let connection = await findConnectionById(connectionId);
  if (!connection || !connection.active) throw new Error("Kick is not connected.");
  if (new Date(connection.token_expires_at).getTime() > Date.now() + 60_000) {
    return decryptSecret(connection.access_token_encrypted);
  }

  const { refreshKickToken } = await import("@/lib/kick/oauth");
  const oldExpiry = connection.token_expires_at;
  const claimed = await query<ConnectionRecord>(
    `UPDATE kick_connections SET token_refresh_started_at = now(), updated_at = now()
     WHERE id = $1
       AND active = true
       AND token_expires_at = $2
       AND (
         token_refresh_started_at IS NULL OR
         token_refresh_started_at < now() - interval '2 minutes'
       )
     RETURNING *`,
    [connectionId, oldExpiry],
  );

  if (!claimed[0]) return waitForRotatedAccessToken(connectionId, oldExpiry);

  let refreshed: KickToken;
  try {
    refreshed = await refreshKickToken(decryptSecret(claimed[0].refresh_token_encrypted));
  } catch (error) {
    await query(
      `UPDATE kick_connections
       SET token_refresh_started_at = NULL, updated_at = now()
       WHERE id = $1 AND token_expires_at = $2`,
      [connectionId, oldExpiry],
    );
    throw error;
  }
  const rows = await query<ConnectionRecord>(
    `UPDATE kick_connections SET
      access_token_encrypted = $1,
      refresh_token_encrypted = $2,
      token_expires_at = $3,
      scopes = $4::text[],
      token_refresh_started_at = NULL,
      updated_at = now()
    WHERE id = $5 AND token_expires_at = $6
    RETURNING *`,
    [
      encryptSecret(refreshed.access_token),
      encryptSecret(refreshed.refresh_token),
      new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      refreshed.scope.split(/\s+/u).filter(Boolean),
      connectionId,
      oldExpiry,
    ],
  );
  connection = rows[0] ?? (await findConnectionById(connectionId));
  if (!connection || !connection.active) {
    throw new Error("Kick connection disappeared during refresh.");
  }
  return decryptSecret(connection.access_token_encrypted);
}

export async function refreshKickChannelIfStale(
  connection: ConnectionRecord,
): Promise<ConnectionRecord> {
  const claimed = await query<ConnectionRecord>(
    `UPDATE kick_connections
     SET updated_at = now()
     WHERE id = $1
       AND active = true
       AND updated_at < now() - interval '10 seconds'
     RETURNING *`,
    [connection.id],
  );
  if (!claimed[0]) return connection;

  const accessToken = await validKickAccessToken(connection.id);
  const { getKickChannel } = await import("@/lib/kick/oauth");
  const channel = await getKickChannel(accessToken);
  const rows = await query<ConnectionRecord>(
    `UPDATE kick_connections SET
      channel_slug = $2,
      is_live = $3,
      stream_title = $4,
      category_name = $5,
      category_id = $6,
      updated_at = now()
     WHERE id = $1 AND active = true
     RETURNING *`,
    [
      connection.id,
      channel.slug,
      channel.isLive,
      channel.streamTitle ?? null,
      channel.categoryName ?? null,
      channel.categoryId ?? null,
    ],
  );
  return rows[0] ?? connection;
}

async function waitForRotatedAccessToken(
  connectionId: string,
  previousExpiry: string,
): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const connection = await findConnectionById(connectionId);
    if (!connection || !connection.active) throw new Error("Kick is not connected.");
    if (connection.token_expires_at !== previousExpiry) {
      return decryptSecret(connection.access_token_encrypted);
    }
  }
  throw new Error("Timed out waiting for the in-progress Kick token refresh.");
}

export async function disconnectConnection(connectionId: string): Promise<void> {
  await query(
    `UPDATE kick_connections SET
      active = false,
      workflow_generation = workflow_generation + 1,
      subscription_ids = '{}',
      token_refresh_started_at = NULL,
      updated_at = now()
    WHERE id = $1`,
    [connectionId],
  );
  await query("DELETE FROM app_sessions WHERE connection_id = $1", [connectionId]);
}
