import { describe, it, expect } from "vitest";
import { verifyKickSignature } from "@/lib/verify-signature";
import { publicKey, signPayload } from "./helpers/test-keys";

const messageId = "01J8XAMPLE";
const timestamp = "2026-07-27T10:00:00Z";
const rawBody = JSON.stringify({ content: "hello chat" });

describe("verifyKickSignature", () => {
  it("accepts a valid signature", () => {
    const sig = signPayload(messageId, timestamp, rawBody);
    expect(verifyKickSignature(publicKey, messageId, timestamp, rawBody, sig)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signPayload(messageId, timestamp, rawBody);
    expect(verifyKickSignature(publicKey, messageId, timestamp, rawBody + "x", sig)).toBe(false);
  });

  it("rejects a signature made for a different message id", () => {
    const sig = signPayload("other-id", timestamp, rawBody);
    expect(verifyKickSignature(publicKey, messageId, timestamp, rawBody, sig)).toBe(false);
  });

  it("returns false (does not throw) on garbage inputs", () => {
    expect(verifyKickSignature("not-a-pem", messageId, timestamp, rawBody, "!!!")).toBe(false);
    expect(verifyKickSignature(publicKey, messageId, timestamp, rawBody, "not-base64-signature")).toBe(false);
  });
});
