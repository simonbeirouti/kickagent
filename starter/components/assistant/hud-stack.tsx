"use client";

import BetCard from "@/components/assistant/bet-card";
import type { AssistantState } from "@/lib/assistant/use-assistant";

/** The notification cards a streamer sees on their glasses. */
export default function HudStack({ state }: { state: AssistantState }) {
  const activeBets = state.bets.filter((b) => b.status !== "declined" && b.status !== "expired");
  const prediction = state.predictions.find((p) => p.status === "open");
  const tip = state.coach[0];

  return (
    <div className="asst-hud-stack">
      {prediction && (
        <div className="asst-hud-card">
          <div className="asst-hud-tag">🏆 LIVE PREDICTION</div>
          <div>{prediction.question}</div>
          <div className="muted">
            YES {prediction.odds.yes}% ({prediction.pools.yes} KICKs) · NO {prediction.odds.no}% ({prediction.pools.no} KICKs)
          </div>
        </div>
      )}
      {activeBets.slice(0, 2).map((bet) => (
        <div key={bet.id} className="asst-hud-card asst-hud-bet">
          <div className="asst-hud-tag">💰 {bet.status === "open" ? "NEW BET" : "BET"}</div>
          <BetCard bet={bet} variant="hud" />
        </div>
      ))}
      {state.meme && (
        <div className="asst-hud-card asst-hud-alert">
          <div className="asst-hud-tag">🔥 HYPE ALERT</div>
          <div>Chat is spamming “{state.meme.token}” <span className="asst-boost-points">+14 HYPE</span></div>
        </div>
      )}
      {tip && (
        <div className="asst-hud-card asst-hud-coach">
          <div className="asst-hud-tag">🤖 AI COACH</div>
          <div>{tip.text}</div>
        </div>
      )}
      {!prediction && activeBets.length === 0 && !tip && (
        <div className="asst-hud-card muted">Waiting for the action to start…</div>
      )}
    </div>
  );
}
