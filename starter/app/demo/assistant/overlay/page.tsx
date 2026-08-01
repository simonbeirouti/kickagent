"use client";

import AssistantChrome from "@/components/assistant/assistant-chrome";
import BetCard from "@/components/assistant/bet-card";
import HypeGauge from "@/components/assistant/hype-gauge";
import MemeOverlay from "@/components/assistant/meme-overlay";
import PredictionCard from "@/components/assistant/prediction-card";
import { useAssistant } from "@/lib/assistant/use-assistant";

export default function ViewerOverlayPage() {
  const state = useAssistant();
  const topBet = state.bets.find((b) => b.status !== "declined" && b.status !== "expired");

  return (
    <AssistantChrome
      title="Stream Overlay"
      subtitle="The viewer-facing overlay for OBS: hype score, live prediction, top bet and AI-triggered meme drops."
      connected={state.connected}
      demo={state.demo}
    >
      <div className="asst-stage" style={{ minHeight: 480 }}>
        <div className="asst-stage-top">
          <div className="asst-col" style={{ maxWidth: 300 }}>
            {state.predictions[0] && <PredictionCard prediction={state.predictions[0]} />}
            {topBet && (
              <div className="asst-panel">
                <BetCard bet={topBet} variant="overlay" />
              </div>
            )}
          </div>
          <div style={{ width: 280 }}>
            <HypeGauge hype={state.hype} />
          </div>
        </div>
        <div className="asst-hud-stack">
          {state.summary.slice(0, 3).map((line, i) => (
            <div key={`${line.at}-${i}`} className="asst-hud-card">
              <div className="asst-hud-tag">📋 LIVE UPDATE</div>
              {line.text}
            </div>
          ))}
        </div>
        <MemeOverlay meme={state.meme} hype={state.hype} />
      </div>
    </AssistantChrome>
  );
}
