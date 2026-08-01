import { KickApiError } from "@/lib/kick-api";

export function kickErrorResponse(e: unknown): Response {
  if (e instanceof KickApiError) {
    return Response.json({ error: e.message }, { status: 502 });
  }
  const message = e instanceof Error ? e.message : "unknown error";
  return Response.json({ error: message }, { status: 500 });
}
