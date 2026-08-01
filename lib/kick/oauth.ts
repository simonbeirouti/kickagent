import { createHash } from "node:crypto";
import { z } from "zod";
import { appUrl, requiredEnv } from "@/lib/env";
import { base64Url } from "@/lib/security";
import {
  kickChannelResponseSchema,
  kickSendChatMessageResponseSchema,
  kickSubscriptionResponseSchema,
  kickTokenSchema,
  kickUserResponseSchema,
  type KickToken,
} from "@/lib/kick/types";

const KICK_ID_BASE_URL = "https://id.kick.com";
const KICK_API_BASE_URL = "https://api.kick.com/public/v1";
export const KICK_SCOPES = [
  "user:read",
  "channel:read",
  "events:subscribe",
  "chat:write",
] as const;
export const KICK_EVENTS = [
  "chat.message.sent",
  "livestream.status.updated",
  "livestream.metadata.updated",
] as const;

export interface KickProfile {
  readonly email?: string;
  readonly name: string;
  readonly profilePicture?: string;
  readonly userId: string;
}

export interface KickChannel {
  readonly categoryId?: string;
  readonly categoryName?: string;
  readonly isLive: boolean;
  readonly slug: string;
  readonly streamTitle?: string;
}

export function redirectUri(): string {
  return `${appUrl()}/api/auth/kick/callback`;
}

export function createCodeChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function createKickAuthorizationUrl(input: {
  readonly codeChallenge: string;
  readonly state: string;
}): string {
  const url = new URL("/oauth/authorize", KICK_ID_BASE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requiredEnv("KICK_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", KICK_SCOPES.join(" "));
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", input.state);
  return url.toString();
}

async function tokenRequest(body: URLSearchParams): Promise<KickToken> {
  const response = await fetch(`${KICK_ID_BASE_URL}/oauth/token`, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
    redirect: "error",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(`Kick token request failed (${response.status}).`);
  }
  return kickTokenSchema.parse(payload);
}

export function exchangeAuthorizationCode(code: string, codeVerifier: string): Promise<KickToken> {
  return tokenRequest(
    new URLSearchParams({
      client_id: requiredEnv("KICK_CLIENT_ID"),
      client_secret: requiredEnv("KICK_CLIENT_SECRET"),
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  );
}

export function refreshKickToken(refreshToken: string): Promise<KickToken> {
  return tokenRequest(
    new URLSearchParams({
      client_id: requiredEnv("KICK_CLIENT_ID"),
      client_secret: requiredEnv("KICK_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

async function kickApi(path: string, accessToken: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${KICK_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
    redirect: "error",
  });
  const payload = response.status === 204 ? undefined : await readJson(response);
  if (!response.ok) {
    throw new Error(`Kick API request failed (${response.status}) for ${path}.`);
  }
  return payload;
}

export async function getKickProfile(accessToken: string): Promise<KickProfile> {
  const payload = kickUserResponseSchema.parse(await kickApi("/users", accessToken));
  const user = payload.data[0];
  return {
    email: user.email ?? undefined,
    name: user.name,
    profilePicture: user.profile_picture ?? undefined,
    userId: user.user_id,
  };
}

export async function getKickChannel(accessToken: string): Promise<KickChannel> {
  const payload = kickChannelResponseSchema.parse(await kickApi("/channels", accessToken));
  const channel = payload.data[0];
  return {
    categoryId: channel.category?.id,
    categoryName: channel.category?.name,
    isLive: channel.stream?.is_live ?? false,
    slug: channel.slug,
    streamTitle: channel.stream_title ?? undefined,
  };
}

/**
 * Post a message into a channel's live chat. `broadcasterUserId` picks the
 * "user" send type (posts as the connected streamer's own account, into
 * their channel); omit it to send as the app's "bot" type instead. Content
 * is capped at 500 chars by the Kick API.
 */
export async function sendKickChatMessage(
  accessToken: string,
  input: {
    readonly content: string;
    readonly broadcasterUserId?: string;
    readonly replyToMessageId?: string;
  },
): Promise<{ readonly isSent: boolean; readonly messageId: string }> {
  const payload = kickSendChatMessageResponseSchema.parse(
    await kickApi("/chat", accessToken, {
      body: JSON.stringify({
        content: input.content,
        type: input.broadcasterUserId ? "user" : "bot",
        ...(input.broadcasterUserId
          ? { broadcaster_user_id: Number(input.broadcasterUserId) }
          : {}),
        ...(input.replyToMessageId ? { reply_to_message_id: input.replyToMessageId } : {}),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
  return { isSent: payload.data.is_sent, messageId: payload.data.message_id };
}

export async function subscribeToKickEvents(accessToken: string): Promise<string[]> {
  const payload = kickSubscriptionResponseSchema.parse(
    await kickApi("/events/subscriptions", accessToken, {
      body: JSON.stringify({
        events: KICK_EVENTS.map((name) => ({ name, version: 1 })),
        method: "webhook",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
  const errors = payload.data.filter((entry) => entry.error);
  if (errors.length > 0) {
    throw new Error(`Kick event subscription failed: ${errors.map((entry) => entry.name).join(", ")}.`);
  }
  return payload.data.flatMap((entry) => (entry.subscription_id ? [entry.subscription_id] : []));
}

export async function deleteKickSubscriptions(
  accessToken: string,
  subscriptionIds: readonly string[],
): Promise<void> {
  if (subscriptionIds.length === 0) return;
  const query = new URLSearchParams();
  for (const id of subscriptionIds) query.append("id", id);
  await kickApi(`/events/subscriptions?${query.toString()}`, accessToken, { method: "DELETE" });
}

export async function revokeKickToken(token: string, hint: "access_token" | "refresh_token") {
  const url = new URL("/oauth/revoke", KICK_ID_BASE_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("token_hint_type", hint);
  const response = await fetch(url, {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Kick token revocation failed (${response.status}).`);
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new z.ZodError([
      {
        code: "custom",
        message: "Kick returned a non-JSON response.",
        path: [],
      },
    ]);
  }
}
