import { query } from "@/lib/db";
import { optionalEnv } from "@/lib/env";
import type { KickChannel, KickProfile } from "@/lib/kick/oauth";
import { decryptJson, encryptJson, randomToken, sha256 } from "@/lib/security";

export const SESSION_COOKIE = "kickagent_session";
export const OAUTH_COOKIE = "kickagent_oauth";
const SESSION_DAYS = 30;
const STATELESS_SESSION_VERSION = 1;

export interface StatelessKickSession {
  readonly channel: KickChannel;
  readonly expiresAt: number;
  readonly profile: KickProfile;
  readonly version: typeof STATELESS_SESSION_VERSION;
}

interface SessionRow extends Record<string, unknown> {
  readonly connection_id: string;
}

export async function createAppSession(connectionId: string): Promise<{
  readonly expiresAt: Date;
  readonly token: string;
}> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO app_sessions (token_hash, connection_id, expires_at)
     VALUES ($1, $2, $3)`,
    [sha256(token), connectionId, expiresAt.toISOString()],
  );
  return { expiresAt, token };
}

export function createStatelessAppSession(input: {
  readonly channel: KickChannel;
  readonly profile: KickProfile;
}): { readonly expiresAt: Date; readonly token: string } {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = encryptJson<StatelessKickSession>({
    ...input,
    expiresAt: expiresAt.getTime(),
    version: STATELESS_SESSION_VERSION,
  });
  return { expiresAt, token };
}

export function statelessKickMode(): boolean {
  return optionalEnv("KICK_STATELESS_MODE")?.toLowerCase() === "true";
}

export function statelessSessionFromRequest(request: Request): StatelessKickSession | undefined {
  if (!statelessKickMode()) return undefined;
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return undefined;
  try {
    const session = decryptJson<StatelessKickSession>(token);
    if (
      session.version !== STATELESS_SESSION_VERSION ||
      session.expiresAt <= Date.now() ||
      !session.profile?.userId ||
      !session.channel?.slug
    ) {
      return undefined;
    }
    return session;
  } catch {
    return undefined;
  }
}

export async function connectionIdFromRequest(request: Request): Promise<string | undefined> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return undefined;
  const rows = await query<SessionRow>(
    `SELECT connection_id FROM app_sessions
     WHERE token_hash = $1 AND expires_at > now()`,
    [sha256(token)],
  );
  return rows[0]?.connection_id;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export const secureCookieDefaults = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
