import { getAppToken } from "@/lib/kick-token";

const API_BASE = "https://api.kick.com";

export class KickApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`Kick API ${status}: ${body}`);
    this.name = "KickApiError";
  }
}

export type KickChannel = {
  broadcaster_user_id: number;
  slug: string;
  stream_title: string;
  channel_description: string;
  banner_picture: string;
  category: { name: string } | null;
  stream: { is_live: boolean; viewer_count: number; start_time: string } | null;
};

export type KickSubscription = {
  id: string;
  event: string;
  version: number;
  broadcaster_user_id: number;
};

export const WATCHED_EVENTS = [
  "chat.message.sent",
  "channel.followed",
  "channel.subscription.new",
  "channel.subscription.gifts",
  "kicks.gifted",
  "livestream.status.updated",
];

async function kickFetch(path: string, init?: { method?: string; body?: string }) {
  const token = await getAppToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body,
  });
  if (!res.ok) throw new KickApiError(res.status, await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export async function getChannelBySlug(slug: string): Promise<KickChannel | null> {
  const data = await kickFetch(`/public/v1/channels?slug=${encodeURIComponent(slug)}`);
  return data?.data?.[0] ?? null;
}

export async function listSubscriptions(): Promise<KickSubscription[]> {
  const data = await kickFetch("/public/v1/events/subscriptions");
  return data?.data ?? [];
}

export async function subscribeToChannel(broadcasterUserId: number): Promise<unknown> {
  const data = await kickFetch("/public/v1/events/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      broadcaster_user_id: broadcasterUserId,
      method: "webhook",
      events: WATCHED_EVENTS.map((name) => ({ name, version: 1 })),
    }),
  });
  return data?.data;
}

export async function deleteSubscriptions(ids: string[]): Promise<void> {
  const qs = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&");
  await kickFetch(`/public/v1/events/subscriptions?${qs}`, { method: "DELETE" });
}

let publicKeyCache: string | null = null;

export async function getKickPublicKey(): Promise<string> {
  if (publicKeyCache) return publicKeyCache;
  const res = await fetch(`${API_BASE}/public/v1/public-key`);
  if (!res.ok) throw new KickApiError(res.status, await res.text());
  const data = await res.json();
  publicKeyCache = data.data.public_key as string;
  return publicKeyCache;
}
