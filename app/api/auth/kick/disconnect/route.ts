import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { deleteKickSubscriptions, revokeKickToken } from "@/lib/kick/oauth";
import {
  disconnectConnection,
  findConnectionById,
  validKickAccessToken,
} from "@/lib/kick/repository";
import { decryptSecret } from "@/lib/security";
import {
  connectionIdFromRequest,
  secureCookieDefaults,
  SESSION_COOKIE,
} from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin || requestOrigin !== new URL(appUrl()).origin) {
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  }
  const connectionId = await connectionIdFromRequest(request);
  if (!connectionId) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const connection = await findConnectionById(connectionId);
  if (connection) {
    try {
      const accessToken = await validKickAccessToken(connectionId);
      await deleteKickSubscriptions(accessToken, connection.subscription_ids);
      const refreshedConnection = await findConnectionById(connectionId);
      await Promise.allSettled([
        revokeKickToken(accessToken, "access_token"),
        refreshedConnection
          ? revokeKickToken(
              decryptSecret(refreshedConnection.refresh_token_encrypted),
              "refresh_token",
            )
          : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Kick cleanup during disconnect failed", error);
    }
    await disconnectConnection(connectionId);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...secureCookieDefaults,
    expires: new Date(0),
    path: "/",
  });
  return response;
}
