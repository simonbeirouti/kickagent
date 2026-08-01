import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/kick-api", async () => {
  const { publicKey } = await import("./helpers/test-keys");
  return { getKickPublicKey: async () => publicKey };
});

import { POST } from "@/app/api/kick/webhook/route";
import { eventBus } from "@/lib/event-bus";
import { signPayload } from "./helpers/test-keys";

function webhookRequest(rawBody: string, signature: string) {
  return new Request("http://localhost/api/kick/webhook", {
    method: "POST",
    headers: {
      "Kick-Event-Message-Id": "01JMSGID",
      "Kick-Event-Message-Timestamp": "2026-07-27T10:00:00Z",
      "Kick-Event-Signature": signature,
      "Kick-Event-Type": "chat.message.sent",
      "Kick-Event-Version": "1",
    },
    body: rawBody,
  });
}

describe("POST /api/kick/webhook", () => {
  beforeEach(() => {
    eventBus.buffer.length = 0;
  });

  it("accepts a correctly signed event and publishes it", async () => {
    const rawBody = JSON.stringify({ content: "hello", sender: { username: "viewer1" } });
    const sig = signPayload("01JMSGID", "2026-07-27T10:00:00Z", rawBody);
    const res = await POST(webhookRequest(rawBody, sig));
    expect(res.status).toBe(200);
    expect(eventBus.buffer).toHaveLength(1);
    expect(eventBus.buffer[0]).toMatchObject({
      id: "01JMSGID",
      type: "chat.message.sent",
      payload: { content: "hello" },
    });
  });

  it("rejects a bad signature with 401 and publishes nothing", async () => {
    const rawBody = JSON.stringify({ content: "hello" });
    const sig = signPayload("01JMSGID", "2026-07-27T10:00:00Z", rawBody + "tampered");
    const res = await POST(webhookRequest(rawBody, sig));
    expect(res.status).toBe(401);
    expect(eventBus.buffer).toHaveLength(0);
  });
});
