import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/auth/kick/start/route";
import { decryptJson } from "@/lib/security";

interface OAuthCookie {
  readonly codeVerifier: string;
  readonly expiresAt: number;
  readonly state: string;
}

describe("Kick OAuth start route", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://companion.example";
    process.env.KICK_CLIENT_ID = "client-id";
    process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key-with-at-least-32-characters";
  });

  it("binds an encrypted, short-lived state cookie to the PKCE redirect", async () => {
    const response = await GET();
    const redirect = new URL(response.headers.get("location")!);
    const setCookie = response.headers.get("set-cookie")!;
    const encodedCookie = setCookie.match(/kickagent_oauth=([^;]+)/u)?.[1];
    expect(encodedCookie).toBeTruthy();

    const oauth = decryptJson<OAuthCookie>(decodeURIComponent(encodedCookie!));
    expect(redirect.origin).toBe("https://id.kick.com");
    expect(redirect.searchParams.get("state")).toBe(oauth.state);
    expect(redirect.searchParams.get("code_challenge")).toHaveLength(43);
    expect(oauth.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(oauth.expiresAt).toBeGreaterThan(Date.now());
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
  });
});
