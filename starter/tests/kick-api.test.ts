import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/kick-token", () => ({
  getAppToken: vi.fn(async () => "test-token"),
}));

import {
  getChannelBySlug,
  subscribeToChannel,
  KickApiError,
  WATCHED_EVENTS,
} from "@/lib/kick-api";

describe("kick-api", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getChannelBySlug returns the first channel with a bearer token", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ slug: "somechannel", broadcaster_user_id: 42 }] }),
      text: async () => "",
    } as Response);

    const channel = await getChannelBySlug("somechannel");
    expect(channel?.broadcaster_user_id).toBe(42);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kick.com/public/v1/channels?slug=somechannel");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("getChannelBySlug returns null when no channel matches", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
      text: async () => "",
    } as Response);
    expect(await getChannelBySlug("nope")).toBeNull();
  });

  it("subscribeToChannel posts all watched events for the broadcaster", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
      text: async () => "",
    } as Response);

    await subscribeToChannel(42);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kick.com/public/v1/events/subscriptions");
    const body = JSON.parse(init.body);
    expect(body.broadcaster_user_id).toBe(42);
    expect(body.method).toBe("webhook");
    expect(body.events).toEqual(WATCHED_EVENTS.map((name) => ({ name, version: 1 })));
  });

  it("throws KickApiError with status and body on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => "forbidden",
    } as Response);
    await expect(getChannelBySlug("x")).rejects.toThrow(KickApiError);
  });
});
