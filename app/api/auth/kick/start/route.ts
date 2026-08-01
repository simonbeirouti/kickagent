import { NextResponse } from "next/server";
import { createKickAuthorizationUrl, createCodeChallenge } from "@/lib/kick/oauth";
import { encryptJson, randomToken } from "@/lib/security";
import { OAUTH_COOKIE, secureCookieDefaults } from "@/lib/session";

export const runtime = "nodejs";

interface OAuthCookie {
  readonly codeVerifier: string;
  readonly expiresAt: number;
  readonly state: string;
}

export async function GET(): Promise<Response> {
  const state = randomToken(24);
  const codeVerifier = randomToken(64);
  const oauthState: OAuthCookie = {
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000,
    state,
  };
  const response = NextResponse.redirect(
    createKickAuthorizationUrl({ codeChallenge: createCodeChallenge(codeVerifier), state }),
  );
  response.cookies.set(OAUTH_COOKIE, encryptJson(oauthState), {
    ...secureCookieDefaults,
    maxAge: 10 * 60,
    path: "/api/auth/kick/callback",
  });
  return response;
}
