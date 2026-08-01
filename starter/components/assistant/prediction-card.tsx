"use client";

import type { PredictionView } from "@/lib/assistant/use-assistant";
import { assistantApi } from "@/lib/assistant/use-assistant";

function endsIn(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "ended";
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export default function PredictionCard({
  prediction,
  variant = "overlay",
  user = "you",
}: {
  prediction: PredictionView;
  variant?: "overlay" | "panel";
  user?: string;
}) {
  const total = prediction.pools.yes + prediction.pools.no;

  return (
    <div className="asst-prediction">
      <div className="asst-prediction-q">
        <span>🏆 {prediction.question}</span>
        <span className="muted">
          {prediction.status === "settled" ? `settled: ${prediction.outcome?.toUpperCase()}` : `Ends in ${endsIn(prediction.endsAt)}`}
        </span>
      </div>
      <div className="asst-odds">
        {(["yes", "no"] as const).map((side) => (
          <div key={side} className={`asst-odds-side asst-odds-${side}`}>
            <div className="asst-odds-fill" style={{ width: `${prediction.odds[side]}%` }} />
            <span className="asst-odds-text">
              {side.toUpperCase()} {prediction.odds[side]}% · {prediction.pools[side]} KICKs
            </span>
            {variant === "panel" && prediction.status === "open" && (
              <button
                className="asst-bet-now"
                onClick={() => assistantApi.placeWager(prediction.id, user, side, 50)}
              >
                Bet 50
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="muted asst-prediction-meta">
        {prediction.wagers.length} wagers · Pool: {total} KICKs
      </div>
    </div>
  );
}
