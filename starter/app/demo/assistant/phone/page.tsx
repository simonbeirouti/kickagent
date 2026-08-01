"use client";

import AssistantChrome from "@/components/assistant/assistant-chrome";
import HypeGauge from "@/components/assistant/hype-gauge";
import PredictionCard from "@/components/assistant/prediction-card";
import { useAssistant } from "@/lib/assistant/use-assistant";

export default function CompanionPhonePage() {
  const state = useAssistant();

  return (
    <AssistantChrome
      title="Companion App"
      subtitle="The mobile view for viewers who can't watch: live hype, predictions and AI push updates so they never miss a moment."
      connected={state.connected}
      demo={state.demo}
    >
      <div className="asst-phone">
        <div className="asst-phone-notch" />
        <HypeGauge hype={state.hype} compact />
        {state.predictions[0] && <PredictionCard prediction={state.predictions[0]} variant="panel" />}
        {state.summary.slice(0, 4).map((line, i) => (
          <div key={`${line.at}-${i}`} className="asst-phone-push">
            <div className="asst-kicker">KICK · Hype Update</div>
            {line.text}
          </div>
        ))}
        {state.summary.length === 0 && (
          <div className="asst-phone-push muted">Push notifications from the AI land here.</div>
        )}
      </div>
    </AssistantChrome>
  );
}
