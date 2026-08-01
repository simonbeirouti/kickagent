"use client";

import AssistantChrome from "@/components/assistant/assistant-chrome";
import BetCard from "@/components/assistant/bet-card";
import ChatPanel from "@/components/assistant/chat-panel";
import CoachPanel from "@/components/assistant/coach-panel";
import HudStack from "@/components/assistant/hud-stack";
import HypeGauge from "@/components/assistant/hype-gauge";
import MemeOverlay from "@/components/assistant/meme-overlay";
import PredictionCard from "@/components/assistant/prediction-card";
import SummaryTimeline from "@/components/assistant/summary-timeline";
import ValidationTicker from "@/components/assistant/validation-ticker";
import { useAssistant } from "@/lib/assistant/use-assistant";

const HOW_IT_WORKS = [
  ["👥", "Viewer creates a prediction or bet"],
  ["🤖", "AI agent monitors the stream in real time"],
  ["✅", "Event validated automatically"],
  ["💸", "Outcome settled, payouts distributed"],
  ["🔥", "Hype increases, community wins"],
] as const;

export default function AssistantShowcase() {
  const state = useAssistant();
  const topBet = state.bets.find((b) => b.status !== "declined" && b.status !== "expired");

  return (
    <AssistantChrome
      title="Kick-Ass(istant)"
      subtitle="One AI agent between streamer and viewers: glasses HUD, live overlay, bets validated by the agent — the whole loop on one screen."
      connected={state.connected}
      demo={state.demo}
      wide
    >
      <div className="asst-composite">
        <div className="asst-col">
          <h2>1 · Glasses HUD — what the streamer sees</h2>
          <div className="asst-hud-scene">
            <HudStack state={state} />
          </div>
          <ValidationTicker bets={state.bets} />
        </div>

        <div className="asst-col">
          <h2>2 · Stream overlay — what viewers see</h2>
          <div className="asst-stage">
            <div className="asst-stage-top">
              {topBet ? (
                <div className="asst-panel" style={{ maxWidth: 260 }}>
                  <BetCard bet={topBet} variant="overlay" />
                </div>
              ) : <span />}
              <div style={{ width: 260 }}>
                <HypeGauge hype={state.hype} compact />
              </div>
            </div>
            {state.predictions[0] && <PredictionCard prediction={state.predictions[0]} />}
            <MemeOverlay meme={state.meme} hype={state.hype} />
          </div>
          <ChatPanel chat={state.chat} />
        </div>

        <div className="asst-col">
          <h2>3 · The agent's brain</h2>
          <HypeGauge hype={state.hype} />
          <CoachPanel coach={state.coach} hype={state.hype} />
          <SummaryTimeline summary={state.summary} />
        </div>
      </div>

      <div className="asst-howto">
        {HOW_IT_WORKS.map(([emoji, text], i) => (
          <div key={text}>
            <span>{emoji}</span>
            {i + 1}. {text}
          </div>
        ))}
      </div>
    </AssistantChrome>
  );
}
