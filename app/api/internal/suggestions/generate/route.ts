import {
  suggestionGenerationRequestSchema,
} from "@/lib/suggestions";
import {
  generateSuggestion,
  SuggestionGenerationTimeoutError,
} from "@/lib/generate-suggestion";
import { verifyInternalJwt } from "@/lib/security";

export const runtime = "nodejs";

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
  console.info("[anthropic:suggestion] started", { connectionId });
  try {
    const statement = await generateSuggestion(parsedRequest.data);
    console.info("[anthropic:suggestion] completed", {
      connectionId,
      durationMs: Date.now() - startedAt,
    });
    return Response.json({ statement }, { headers: responseHeaders });
  } catch (error) {
    const timedOut = error instanceof SuggestionGenerationTimeoutError;
    const status = timedOut ? 504 : 502;
    console.error("[anthropic:suggestion] failed", {
      connectionId,
      durationMs: Date.now() - startedAt,
      status,
    });
    return errorResponse(timedOut ? "Suggestion generation timed out." : "Suggestion generation failed.", status);
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
