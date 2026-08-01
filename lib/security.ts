import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { requiredEnv } from "@/lib/env";

const ENCRYPTION_VERSION = "v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function encryptionKey(): Buffer {
  const secret = requiredEnv("TOKEN_ENCRYPTION_KEY");
  if (secret.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must contain at least 32 characters.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, base64Url(iv), base64Url(tag), base64Url(ciphertext)].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = payload.split(".");
  if (
    version !== ENCRYPTION_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  ) {
    throw new Error("Invalid encrypted payload.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptJson<T>(value: T): string {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decryptSecret(payload)) as T;
}

export function signInternalJwt(now?: Date): string;
export function signInternalJwt(connectionId?: string, now?: Date): string;
export function signInternalJwt(
  connectionIdOrNow?: string | Date,
  suppliedNow?: Date,
): string {
  const connectionId =
    typeof connectionIdOrNow === "string" ? connectionIdOrNow : undefined;
  const now = connectionIdOrNow instanceof Date ? connectionIdOrNow : suppliedNow ?? new Date();
  const secret = requiredEnv("INTERNAL_API_AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("INTERNAL_API_AUTH_SECRET must contain at least 32 characters.");
  }
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = base64Url(
    JSON.stringify({
      aud: "kickagent-internal",
      exp: issuedAt + 120,
      iat: issuedAt,
      iss: "kickagent",
      sub: "kick-analysis",
      ...(connectionId ? { connection_id: connectionId } : {}),
    }),
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export interface InternalJwtClaims {
  readonly connectionId: string;
}

export function verifyInternalJwt(token: string, now = new Date()): InternalJwtClaims {
  const [encodedHeader, encodedPayload, suppliedSignature, ...extraParts] = token.split(".");
  if (!encodedHeader || !encodedPayload || !suppliedSignature || extraParts.length > 0) {
    throw new Error("Invalid internal token.");
  }
  const secret = requiredEnv("INTERNAL_API_AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("INTERNAL_API_AUTH_SECRET must contain at least 32 characters.");
  }
  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) {
    throw new Error("Invalid internal token.");
  }

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString()) as Record<
      string,
      unknown
    >;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as Record<
      string,
      unknown
    >;
    const currentTime = Math.floor(now.getTime() / 1_000);
    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      payload.aud !== "kickagent-internal" ||
      payload.iss !== "kickagent" ||
      payload.sub !== "kick-analysis" ||
      typeof payload.exp !== "number" ||
      payload.exp <= currentTime ||
      typeof payload.iat !== "number" ||
      payload.iat > currentTime + 30 ||
      typeof payload.connection_id !== "string" ||
      !UUID_PATTERN.test(payload.connection_id)
    ) {
      throw new Error("Invalid internal token.");
    }
    return { connectionId: payload.connection_id };
  } catch {
    throw new Error("Invalid internal token.");
  }
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
