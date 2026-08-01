import { beforeEach, describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  decryptJson,
  decryptSecret,
  encryptJson,
  encryptSecret,
  signInternalJwt,
  verifyInternalJwt,
} from "@/lib/security";

describe("security helpers", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key-with-at-least-32-characters";
    process.env.INTERNAL_API_AUTH_SECRET = "test-internal-secret-with-at-least-32-characters";
  });

  it("encrypts and authenticates secrets", () => {
    const encrypted = encryptSecret("kick-token");
    expect(encrypted).not.toContain("kick-token");
    expect(decryptSecret(encrypted)).toBe("kick-token");
    const parts = encrypted.split(".");
    parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("round-trips JSON OAuth state", () => {
    const value = { codeVerifier: "abc", expiresAt: 123, state: "xyz" };
    expect(decryptJson(encryptJson(value))).toEqual(value);
  });

  it("creates a short-lived HS256 internal token", () => {
    const token = signInternalJwt(new Date("2026-08-01T00:00:00Z"));
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toMatchObject({ alg: "HS256" });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toMatchObject({
      aud: "kickagent-internal",
      exp: 1785542520,
      iss: "kickagent",
      sub: "kick-analysis",
    });
    expect(signature).toBeTruthy();
  });

  it("verifies a connection-scoped internal token", () => {
    const connectionId = "00000000-0000-4000-8000-000000000001";
    const issuedAt = new Date("2026-08-01T00:00:00Z");
    const token = signInternalJwt(connectionId, issuedAt);

    expect(verifyInternalJwt(token, new Date("2026-08-01T00:01:00Z"))).toEqual({ connectionId });
  });

  it("rejects expired, tampered, and unscoped internal tokens", () => {
    const connectionId = "00000000-0000-4000-8000-000000000001";
    const issuedAt = new Date("2026-08-01T00:00:00Z");
    const token = signInternalJwt(connectionId, issuedAt);
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    expect(() => verifyInternalJwt(token, new Date("2026-08-01T00:02:01Z"))).toThrow();
    expect(() => verifyInternalJwt(tampered, new Date("2026-08-01T00:01:00Z"))).toThrow();
    expect(() => verifyInternalJwt(signInternalJwt(issuedAt), issuedAt)).toThrow();
  });

  it("compares state without accepting different values", () => {
    expect(constantTimeEqual("same", "same")).toBe(true);
    expect(constantTimeEqual("same", "different")).toBe(false);
  });
});
