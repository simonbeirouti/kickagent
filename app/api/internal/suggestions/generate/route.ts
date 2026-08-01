import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import {
  buildSuggestionPrompt,
  SUGGESTION_SYSTEM_PROMPT,
  suggestionGenerationRequestSchema,
  suggestionGenerationResponseSchema,
} from "@/lib/suggestions";
import { verifyInternalJwt } from "@/lib/security";

export const runtime = "nodejs";

const GENERATION_TIMEOUT_MS = 15_000;
const responseHeaders = { "cache-control": "private, no-store, max-age=0" };

export async function POST(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return errorResponse("Unauthorized.", 401);

  let connectionId: string;
  try {
    connectionId = verifyInternalJwt(token).connectionId;
  } catch {
    return errorResponse("Unauthorized.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request.", 400);
  }
  const parsedRequest = suggestionGenerationRequestSchema.safeParse(body);
  if (!parsedRequest.success) return errorResponse("Invalid request.", 400);

  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GENERATION_TIMEOUT_MS);
  console.info("[anthropic:suggestion] started", { connectionId });
  try {
    const { output } = await generateText({
      abortSignal: controller.signal,
      maxOutputTokens: 120,
      maxRetries: 1,
      model: anthropic("claude-haiku-4-5"),
      output: Output.object({ schema: suggestionGenerationResponseSchema }),
      prompt: buildSuggestionPrompt(parsedRequest.data),
      system: SUGGESTION_SYSTEM_PROMPT,
    });
    const result = suggestionGenerationResponseSchema.parse(output);
    console.info("[anthropic:suggestion] completed", {
      connectionId,
      durationMs: Date.now() - startedAt,
    });
    return Response.json(result, { headers: responseHeaders });
  } catch {
    const status = timedOut ? 504 : 502;
    console.error("[anthropic:suggestion] failed", {
      connectionId,
      durationMs: Date.now() - startedAt,
      status,
    });
    return errorResponse(timedOut ? "Suggestion generation timed out." : "Suggestion generation failed.", status);
  } finally {
    clearTimeout(timeout);
  }
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/iu);
  return match?.[1];
}

function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { headers: responseHeaders, status });
}
