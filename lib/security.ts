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
  const secret = requiredEnv("EVE_INTERNAL_AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("EVE_INTERNAL_AUTH_SECRET must contain at least 32 characters.");
  }
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = base64Url(
    JSON.stringify({
      aud: "eve-internal",
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

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
