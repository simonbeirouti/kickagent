import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { nextWindow, verifyKickWebhook, windowStartFor } from "@/lib/kick/webhook";

describe("Kick webhook helpers", () => {
  it("assigns messages to UTC-aligned 30-second windows", () => {
    expect(windowStartFor(new Date("2026-08-01T01:02:29.999Z")).toISOString()).toBe(
      "2026-08-01T01:02:00.000Z",
    );
    expect(windowStartFor(new Date("2026-08-01T01:02:30.000Z")).toISOString()).toBe(
      "2026-08-01T01:02:30.000Z",
    );
    expect(nextWindow(new Date("2026-08-01T01:02:42Z"))).toEqual({
      end: new Date("2026-08-01T01:03:00.000Z"),
      start: new Date("2026-08-01T01:02:30.000Z"),
    });
  });

  it("verifies the exact raw webhook body and headers", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.KICK_PUBLIC_KEY = publicKey.export({ format: "pem", type: "spki" }).toString();
    const rawBody = '{"message_id":"abc","content":"hello"}';
    const messageId = "01KICKMESSAGE";
    const timestamp = new Date().toISOString();
    const signature = sign(
      "RSA-SHA256",
      Buffer.from(`${messageId}.${timestamp}.${rawBody}`),
      privateKey,
    ).toString("base64");
    const request = new Request("https://companion.example/api/kick/webhook", {
      headers: {
        "Kick-Event-Message-Id": messageId,
        "Kick-Event-Message-Timestamp": timestamp,
        "Kick-Event-Signature": signature,
        "Kick-Event-Type": "chat.message.sent",
        "Kick-Event-Version": "1",
      },
    });
    expect(verifyKickWebhook(request, rawBody)).toMatchObject({
      eventMessageId: messageId,
      eventType: "chat.message.sent",
      eventVersion: "1",
    });
    expect(() => verifyKickWebhook(request, `${rawBody} `)).toThrow("signature");
  });
});
