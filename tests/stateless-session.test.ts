import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getOverlayState } from "@/app/api/overlay/state/route";
import {
  createOverlayAccessToken,
  createStatelessAppSession,
  overlayAccessFromRequest,
  SESSION_COOKIE,
  statelessSessionFromRequest,
} from "@/lib/session";

describe("stateless Kick session", () => {
  beforeEach(() => {
    process.env.KICK_STATELESS_MODE = "true";
    process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key-with-at-least-32-characters";
  });

  afterEach(() => {
    delete process.env.KICK_STATELESS_MODE;
    vi.unstubAllGlobals();
  });

  it("round-trips the Kick profile and channel through an encrypted cookie", () => {
    const created = createStatelessAppSession({
      accessToken: "kick-access-token",
      channel: { isLive: false, slug: "bsimon" },
      profile: { email: "hello@simonbeirouti.com", name: "bsimon", userId: "4083762" },
    });
    const request = new Request("http://localhost/api/overlay/state", {
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(created.token)}` },
    });

    expect(statelessSessionFromRequest(request)).toMatchObject({
      accessToken: "kick-access-token",
      channel: { slug: "bsimon" },
      profile: { userId: "4083762" },
      version: 2,
    });
    expect(created.token).not.toContain("kick-access-token");
  });

  it("refreshes live status from Kick when the dashboard requests a sync", async () => {
    const created = createStatelessAppSession({
      accessToken: "kick-access-token",
      channel: { isLive: false, slug: "bsimon" },
      profile: { name: "bsimon", userId: "4083762" },
    });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ authorization: "Bearer kick-access-token" });
      return Response.json({
        data: [
          {
            broadcaster_user_id: 4083762,
            category: { id: 1, name: "Just Chatting" },
            slug: "bsimon",
            stream: { is_live: true },
            stream_title: "Live now",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/overlay/state?sync=kick", {
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(created.token)}` },
    });

    const response = await getOverlayState(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      channel: { category: "Just Chatting", streamTitle: "Live now" },
      ingestionEnabled: false,
      live: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects an invalid stateless cookie", () => {
    const request = new Request("http://localhost/api/overlay/state", {
      headers: { cookie: `${SESSION_COOKIE}=invalid` },
    });
    expect(statelessSessionFromRequest(request)).toBeUndefined();
  });

  it("serves overlay state without a cookie through a read-only public token", async () => {
    const created = createStatelessAppSession({
      accessToken: "kick-access-token",
      channel: { isLive: true, slug: "bsimon" },
      profile: { name: "bsimon", userId: "4083762" },
    });
    const cookieRequest = new Request("http://localhost/api/overlay/state", {
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(created.token)}` },
    });
    const session = statelessSessionFromRequest(cookieRequest)!;
    const layout = [{ height: 5, id: "hype", kind: "hype" as const, width: 8, x: 10, y: 4 }];
    const token = createOverlayAccessToken({ layout, session });
    const publicRequest = new Request(
      `http://localhost/api/overlay/state?token=${encodeURIComponent(token)}`,
    );

    expect(overlayAccessFromRequest(publicRequest)).toMatchObject({ kind: "stateless", layout });
    const response = await getOverlayState(publicRequest);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      channel: { slug: "bsimon" },
      layout,
    });
  });

  it("rejects an invalid public overlay token", () => {
    const request = new Request("http://localhost/api/overlay/state?token=invalid");
    expect(overlayAccessFromRequest(request)).toBeUndefined();
  });
});
