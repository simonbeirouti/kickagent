import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { appUrl, optionalEnv } from "@/lib/env";
import {
  deleteKickSubscriptions,
  exchangeAuthorizationCode,
  getKickChannel,
  getKickProfile,
  subscribeToKickEvents,
} from "@/lib/kick/oauth";
import { findOwnerConnection, upsertKickConnection } from "@/lib/kick/repository";
import { constantTimeEqual, decryptJson } from "@/lib/security";
import {
  createAppSession,
  OAUTH_COOKIE,
  readCookie,
  secureCookieDefaults,
  SESSION_COOKIE,
} from "@/lib/session";
import { kickSuggestionWorkflow } from "@/workflows/kick-suggestions";

export const runtime = "nodejs";

interface OAuthCookie {
  readonly codeVerifier: string;
  readonly expiresAt: number;
  readonly state: string;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = readCookie(request.headers.get("cookie"), OAUTH_COOKIE);
  if (!code || !state || !cookie) return errorRedirect("oauth_state_missing");

  try {
    const oauth = decryptJson<OAuthCookie>(cookie);
    if (oauth.expiresAt < Date.now() || !constantTimeEqual(state, oauth.state)) {
      return errorRedirect("oauth_state_invalid");
    }
    const token = await exchangeAuthorizationCode(code, oauth.codeVerifier);
    const [profile, channel] = await Promise.all([
      getKickProfile(token.access_token),
      getKickChannel(token.access_token),
    ]);
    const allowedUserId = optionalEnv("KICK_ALLOWED_USER_ID");
    if (allowedUserId && allowedUserId !== profile.userId) return errorRedirect("account_not_allowed");
    const owner = await findOwnerConnection();
    if (owner && owner.kick_user_id !== profile.userId) return errorRedirect("owner_already_connected");

    if (owner?.subscription_ids.length) {
      await deleteKickSubscriptions(token.access_token, owner.subscription_ids);
    }

    const subscriptionIds = await subscribeToKickEvents(token.access_token);
    const connection = await upsertKickConnection({ channel, profile, subscriptionIds, token });
    const session = await createAppSession(connection.id);
    await start(kickSuggestionWorkflow, [connection.id, connection.workflow_generation]);

    const response = NextResponse.redirect(appUrl());
    response.cookies.set(SESSION_COOKIE, session.token, {
      ...secureCookieDefaults,
      expires: session.expiresAt,
      path: "/",
    });
    response.cookies.set(OAUTH_COOKIE, "", {
      ...secureCookieDefaults,
      expires: new Date(0),
      path: "/api/auth/kick/callback",
    });
    return response;
  } catch (error) {
    console.error("Kick OAuth callback failed", error);
    return errorRedirect("kick_connection_failed");
  }
}

function errorRedirect(code: string): Response {
  const url = new URL(appUrl());
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}
