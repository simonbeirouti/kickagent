"use client";

import { useState } from "react";
import AssistantChrome from "@/components/assistant/assistant-chrome";
import BetCard from "@/components/assistant/bet-card";
import PredictionCard from "@/components/assistant/prediction-card";
import { assistantApi, useAssistant } from "@/lib/assistant/use-assistant";

export default function BetsPanelPage() {
  const state = useAssistant();
  const [tab, setTab] = useState<"predictions" | "bets">("predictions");
  const [user, setUser] = useState("HypeKing");
  const [question, setQuestion] = useState("");
  const [condition, setCondition] = useState("");
  const [wager, setWager] = useState(50);

  return (
    <AssistantChrome
      title="Predictions & Bets"
      subtitle="The viewer panel: wager KICKs on predictions, or bet the streamer performs a real-world action — the AI agent validates the outcome."
      connected={state.connected}
      demo={state.demo}
    >
      <section>
        <div className="row" style={{ marginBottom: 12 }}>
          <button
            className={tab === "predictions" ? "primary" : ""}
            onClick={() => setTab("predictions")}
          >
            Predictions
          </button>
          <button className={tab === "bets" ? "primary" : ""} onClick={() => setTab("bets")}>
            Action Bets
          </button>
          <span className="muted" style={{ marginLeft: "auto" }}>betting as</span>
          <input value={user} onChange={(e) => setUser(e.target.value)} style={{ width: 140 }} />
        </div>

        {tab === "predictions" ? (
          <div className="asst-col">
            {state.predictions.length === 0 && (
              <p className="muted">No predictions yet — create the first one below.</p>
            )}
            {state.predictions.map((p) => (
              <PredictionCard key={p.id} prediction={p} variant="panel" user={user} />
            ))}
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!question.trim()) return;
                void assistantApi.createPrediction(question.trim());
                setQuestion("");
              }}
            >
              <input
                placeholder="Will the streamer hit 13,000 trophies?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                style={{ flex: 1, minWidth: 260 }}
              />
              <button className="primary" type="submit">+ Create Prediction</button>
            </form>
          </div>
        ) : (
          <div className="asst-col">
            {state.bets.length === 0 && (
              <p className="muted">No action bets yet — dare the streamer to do something.</p>
            )}
            {state.bets.map((b) => (
              <div key={b.id} className="asst-panel">
                <BetCard bet={b} variant="overlay" />
              </div>
            ))}
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!condition.trim() || !(wager > 0)) return;
                void assistantApi.createBet(user, wager, condition.trim());
                setCondition("");
              }}
            >
              <input
                placeholder="If you talk to the girls on the left"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                style={{ flex: 1, minWidth: 260 }}
              />
              <input
                type="number"
                min={1}
                value={wager}
                onChange={(e) => setWager(Number(e.target.value))}
                style={{ width: 90 }}
              />
              <button className="primary" type="submit">+ Place Bet</button>
            </form>
          </div>
        )}
      </section>
    </AssistantChrome>
  );
}
