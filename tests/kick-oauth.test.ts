import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCodeChallenge,
  createKickAuthorizationUrl,
  KICK_SCOPES,
  refreshKickToken,
} from "@/lib/kick/oauth";

describe("Kick OAuth", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates the RFC 7636 S256 challenge", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(createCodeChallenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("requests only the required Kick scopes", () => {
    process.env.APP_URL = "https://companion.example";
    process.env.KICK_CLIENT_ID = "client-id";
    const url = new URL(createKickAuthorizationUrl({ codeChallenge: "challenge", state: "state" }));
    expect(url.origin).toBe("https://id.kick.com");
    expect(url.searchParams.get("scope")).toBe(KICK_SCOPES.join(" "));
    expect(url.searchParams.get("scope")).not.toContain("chat:write");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://companion.example/api/auth/kick/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("uses and returns the rotated refresh token", async () => {
    process.env.KICK_CLIENT_ID = "client-id";
    process.env.KICK_CLIENT_SECRET = "client-secret";
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new URLSearchParams(init.body as string).get("refresh_token")).toBe("old-refresh");
      expect(new URLSearchParams(init.body as string).get("grant_type")).toBe("refresh_token");
      return Response.json({
        access_token: "new-access",
        expires_in: 3600,
        refresh_token: "new-refresh",
        scope: KICK_SCOPES.join(" "),
        token_type: "Bearer",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshKickToken("old-refresh")).resolves.toMatchObject({
      access_token: "new-access",
      refresh_token: "new-refresh",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
