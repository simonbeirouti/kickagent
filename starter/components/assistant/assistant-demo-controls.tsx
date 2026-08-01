"use client";

import { assistantApi, type DemoView } from "@/lib/assistant/use-assistant";

async function inject(body: Record<string, unknown>) {
  await fetch("/api/fake-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function AssistantDemoControls({ demo }: { demo: DemoView }) {
  return (
    <div className="demo-bar">
      {demo.playing ? (
        <>
          <button onClick={() => assistantApi.demo("stop")}>⏹ stop story</button>
          <span className="asst-kicker">▶ {demo.label ?? demo.step}</span>
        </>
      ) : (
        <button className="primary" onClick={() => assistantApi.demo("play")}>
          🎬 play the story
        </button>
      )}
      <span className="muted">Inject:</span>
      <button onClick={() => assistantApi.demo("burst67")}>6️⃣7️⃣ spam 67</button>
      <button
        onClick={() =>
          assistantApi.createBet("HypeKing", 50, "If you talk to the girls on the left")
        }
      >
        🎯 new bet
      </button>
      <button onClick={() => inject({ type: "channel.subscription.new" })}>⭐ sub</button>
      <button onClick={() => inject({ burst: 18 })}>🔥 hype burst</button>
    </div>
  );
}
