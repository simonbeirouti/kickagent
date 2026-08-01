"use client";

import type { HypeView } from "@/lib/assistant/use-assistant";

export default function HypeGauge({ hype, compact }: { hype: HypeView; compact?: boolean }) {
  const flames = hype.score >= 80 ? "🔥🔥🔥" : hype.score >= 50 ? "🔥🔥" : hype.score >= 20 ? "🔥" : "💤";

  return (
    <div className={`asst-gauge ${compact ? "asst-gauge-compact" : ""}`}>
      <div className="asst-gauge-head">
        <span className="asst-kicker">🔥 Hype Score</span>
        <span className="muted">{hype.velocity} msgs/min</span>
      </div>
      <div className="asst-gauge-readout">
        <span className="asst-gauge-number">{Math.round(hype.score)}</span>
        <span className="asst-gauge-label">{hype.label} {flames}</span>
      </div>
      <div className="asst-gauge-track">
        <div className="asst-gauge-fill" style={{ width: `${Math.round(hype.score)}%` }} />
      </div>
      {!compact && hype.breakdown.length > 0 && (
        <ul className="asst-boosts">
          {hype.breakdown.slice(0, 4).map((s) => (
            <li key={s.label}>
              <span>{s.label}</span>
              <span className="asst-boost-points">+{Math.round(s.points)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
