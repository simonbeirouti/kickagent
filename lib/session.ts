import { query } from "@/lib/db";
import { optionalEnv } from "@/lib/env";
import type { KickChannel, KickProfile } from "@/lib/kick/oauth";
import type { OverlayLayout } from "@/lib/overlay-layout";
import { decryptJson, encryptJson, randomToken, sha256 } from "@/lib/security";

export const SESSION_COOKIE = "kickagent_session";
export const OAUTH_COOKIE = "kickagent_oauth";
const SESSION_DAYS = 30;
const STATELESS_SESSION_VERSION = 2;
const OVERLAY_ACCESS_VERSION = 1;

export interface StatelessKickSession {
  readonly accessToken: string;
  readonly channel: KickChannel;
  readonly expiresAt: number;
  readonly profile: KickProfile;
  readonly version: typeof STATELESS_SESSION_VERSION;
}

export type OverlayAccess =
  | {
      readonly connectionId: string;
      readonly kind: "connection";
      readonly version: typeof OVERLAY_ACCESS_VERSION;
      readonly workflowGeneration: number;
    }
  | {
      readonly kind: "stateless";
      readonly layout: OverlayLayout;
      readonly session: StatelessKickSession;
      readonly version: typeof OVERLAY_ACCESS_VERSION;
    };

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
  readonly accessToken: string;
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

export function createOverlayAccessToken(
  input:
    | { readonly connectionId: string; readonly workflowGeneration: number }
    | { readonly layout: OverlayLayout; readonly session: StatelessKickSession },
): string {
  return encryptJson<OverlayAccess>(
    "session" in input
      ? {
          kind: "stateless",
          layout: input.layout,
          session: input.session,
          version: OVERLAY_ACCESS_VERSION,
        }
      : {
          connectionId: input.connectionId,
          kind: "connection",
          version: OVERLAY_ACCESS_VERSION,
          workflowGeneration: input.workflowGeneration,
        },
  );
}

export function overlayAccessFromRequest(request: Request): OverlayAccess | undefined {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return undefined;
  try {
    const access = decryptJson<OverlayAccess>(token);
    if (access.version !== OVERLAY_ACCESS_VERSION) return undefined;
    if (access.kind === "connection") {
      return access.connectionId && Number.isInteger(access.workflowGeneration) ? access : undefined;
    }
    if (access.kind === "stateless") {
      return validStatelessSession(access.session) ? access : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
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
    return validStatelessSession(session) ? session : undefined;
  } catch {
    return undefined;
  }
}

function validStatelessSession(session: StatelessKickSession): boolean {
  return (
    session?.version === STATELESS_SESSION_VERSION &&
    session.expiresAt > Date.now() &&
    Boolean(session.accessToken) &&
    Boolean(session.profile?.userId) &&
    Boolean(session.channel?.slug)
  );
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
