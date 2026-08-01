import { burst67, demoStatus, playDemo, stopDemo } from "@/lib/assistant/demo-script";
import { ensureAssistantRuntime } from "@/lib/assistant/runtime";

export async function POST(req: Request): Promise<Response> {
  ensureAssistantRuntime();
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action === "play") playDemo();
  else if (action === "stop") stopDemo();
  else if (action === "burst67") burst67();
  else return Response.json({ error: "action must be play, stop or burst67" }, { status: 400 });
  return Response.json(demoStatus());
}
