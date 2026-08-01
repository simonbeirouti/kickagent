import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAppToken, _resetTokenCache } from "@/lib/kick-token";

function mockTokenResponse(token: string, expiresIn: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: token, token_type: "Bearer", expires_in: expiresIn }),
    text: async () => "",
  } as Response;
}

describe("getAppToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T10:00:00Z"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("KICK_CLIENT_ID", "test-client-id");
    vi.stubEnv("KICK_CLIENT_SECRET", "test-client-secret");
    fetchMock.mockReset();
    _resetTokenCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("fetches a token with the client credentials grant", async () => {
    fetchMock.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    const token = await getAppToken();
    expect(token).toBe("tok-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://id.kick.com/oauth/token");
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("test-client-id");
    expect(body.get("client_secret")).toBe("test-client-secret");
  });

  it("reuses the cached token while valid", async () => {
    fetchMock.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    await getAppToken();
    const token = await getAppToken();
    expect(token).toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes when within 60s of expiry", async () => {
    fetchMock.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    await getAppToken();
    vi.setSystemTime(new Date("2026-07-27T10:59:30Z")); // 30s before expiry
    fetchMock.mockResolvedValueOnce(mockTokenResponse("tok-2", 3600));
    const token = await getAppToken();
    expect(token).toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws with status and body on failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "invalid client",
    } as Response);
    await expect(getAppToken()).rejects.toThrow(/401.*invalid client/);
  });
});
