import { getChannelBySlug } from "@/lib/kick-api";
import { kickErrorResponse } from "@/lib/http";

export async function GET(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) return Response.json({ error: "slug query param required" }, { status: 400 });

  try {
    const channel = await getChannelBySlug(slug);
    if (!channel) return Response.json({ error: `channel "${slug}" not found` }, { status: 404 });
    return Response.json(channel);
  } catch (e) {
    return kickErrorResponse(e);
  }
}
