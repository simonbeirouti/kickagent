import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { anthropic, generateText } = vi.hoisted(() => ({
  anthropic: vi.fn(() => ({ modelId: "claude-haiku-4-5" })),
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({ anthropic }));
vi.mock("ai", () => ({
  generateText,
  Output: { object: vi.fn((value) => value) },
}));

import { POST } from "@/app/api/internal/suggestions/generate/route";
import { signInternalJwt } from "@/lib/security";

const connectionId = "00000000-0000-4000-8000-000000000001";
const validBody = {
  categoryName: "Just Chatting",
  messages: [{ content: "What is your best setup upgrade?", createdAt: "now", username: "viewer" }],
  recentSuggestions: ["Ask about the first stream."],
  streamTitle: "Late night catch-up",
};

describe("internal suggestion generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVE_INTERNAL_AUTH_SECRET = "test-internal-secret-with-at-least-32-characters";
    generateText.mockResolvedValue({ output: { statement: "Ask chat which setup upgrade mattered most." } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects unauthenticated and malformed requests", async () => {
    const unauthorized = await POST(request(validBody));
    expect(unauthorized.status).toBe(401);

    const malformed = await POST(new Request("http://localhost/api/internal/suggestions/generate", {
      body: "{",
      headers: {
        authorization: `Bearer ${signInternalJwt(connectionId)}`,
        "content-type": "application/json",
      },
      method: "POST",
    }));
    expect(malformed.status).toBe(400);

    const invalid = await POST(request({ ...validBody, messages: Array(6).fill(validBody.messages[0]) }, true));
    expect(invalid.status).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns one validated statement from Anthropic", async () => {
    const response = await POST(request(validBody, true));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      statement: "Ask chat which setup upgrade mattered most.",
    });
    expect(anthropic).toHaveBeenCalledWith("claude-haiku-4-5");
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      maxOutputTokens: 120,
      maxRetries: 1,
    }));
  });

  it("maps invalid model output and provider errors to a safe 502", async () => {
    generateText.mockResolvedValueOnce({ output: { statement: "x".repeat(141) } });
    const invalidOutput = await POST(request(validBody, true));
    expect(invalidOutput.status).toBe(502);
    await expect(invalidOutput.json()).resolves.toEqual({ error: "Suggestion generation failed." });

    generateText.mockRejectedValueOnce(new Error("provider secret details"));
    const providerError = await POST(request(validBody, true));
    expect(providerError.status).toBe(502);
    await expect(providerError.json()).resolves.toEqual({ error: "Suggestion generation failed." });
  });

  it("returns a safe 504 when generation times out", async () => {
    vi.useFakeTimers();
    generateText.mockImplementationOnce(({ abortSignal }: { abortSignal: AbortSignal }) =>
      new Promise((_, reject) => abortSignal.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const pendingResponse = POST(request(validBody, true));
    await vi.advanceTimersByTimeAsync(15_000);
    const response = await pendingResponse;

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ error: "Suggestion generation timed out." });
  });
});

function request(body: unknown, authenticated = false): Request {
  return new Request("http://localhost/api/internal/suggestions/generate", {
    body: JSON.stringify(body),
    headers: {
      ...(authenticated ? { authorization: `Bearer ${signInternalJwt(connectionId)}` } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  });
}
