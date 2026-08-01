"use client";

import AssistantChrome from "@/components/assistant/assistant-chrome";
import HudStack from "@/components/assistant/hud-stack";
import ValidationTicker from "@/components/assistant/validation-ticker";
import { useAssistant } from "@/lib/assistant/use-assistant";

export default function GlassesHudPage() {
  const state = useAssistant();

  return (
    <AssistantChrome
      title="Glasses HUD"
      subtitle="What the streamer sees on their Meta glasses: incoming bets to accept, live predictions, hype alerts and AI coach tips."
      connected={state.connected}
      demo={state.demo}
    >
      <div className="asst-hud-scene" style={{ minHeight: 520 }}>
        <HudStack state={state} />
      </div>
      <div style={{ marginTop: 12 }}>
        <ValidationTicker bets={state.bets} />
      </div>
    </AssistantChrome>
  );
}
