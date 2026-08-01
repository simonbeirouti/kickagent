import { beforeEach, describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  decryptJson,
  decryptSecret,
  encryptJson,
  encryptSecret,
  signInternalJwt,
} from "@/lib/security";

describe("security helpers", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key-with-at-least-32-characters";
    process.env.EVE_INTERNAL_AUTH_SECRET = "test-internal-secret-with-at-least-32-characters";
  });

  it("encrypts and authenticates secrets", () => {
    const encrypted = encryptSecret("kick-token");
    expect(encrypted).not.toContain("kick-token");
    expect(decryptSecret(encrypted)).toBe("kick-token");
    expect(() => decryptSecret(`${encrypted.slice(0, -1)}x`)).toThrow();
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
      aud: "eve-internal",
      exp: 1785542520,
      iss: "kickagent",
      sub: "kick-analysis",
    });
    expect(signature).toBeTruthy();
  });

  it("compares state without accepting different values", () => {
    expect(constantTimeEqual("same", "same")).toBe(true);
    expect(constantTimeEqual("same", "different")).toBe(false);
  });
});
