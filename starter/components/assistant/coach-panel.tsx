"use client";

import type { HypeView, LineView } from "@/lib/assistant/use-assistant";

export default function CoachPanel({ coach, hype }: { coach: LineView[]; hype: HypeView }) {
  const engagement = hype.score >= 80 ? "Very High" : hype.score >= 50 ? "High" : hype.score >= 20 ? "Medium" : "Low";

  return (
    <div className="asst-panel">
      <div className="asst-panel-head">
        <span className="asst-kicker">🎧 AI Coach</span>
        <span className="asst-live-badge">LIVE</span>
      </div>
      {coach.length === 0 ? (
        <p className="muted">Tips for the streamer land here as the agent reads the room.</p>
      ) : (
        <ul className="asst-tips">
          {coach.slice(0, 3).map((tip, i) => (
            <li key={`${tip.at}-${i}`}>
              {tip.kind === "pivot" && <span className="asst-tip-badge">PIVOT</span>}
              {tip.kind === "trending" && <span className="asst-tip-badge asst-tip-badge-trend">TRENDING GAP</span>}
              {tip.text}
            </li>
          ))}
        </ul>
      )}
      {hype.topics.length > 0 && (
        <div className="asst-topics">
          <span className="muted">Chat is on:</span>
          {hype.topics.slice(0, 4).map((t) => (
            <span key={t.topic} className={`asst-topic-chip asst-topic-${t.trend}`}>
              {t.trend === "rising" ? "↑ " : t.trend === "falling" ? "↓ " : ""}
              {t.topic}
            </span>
          ))}
        </div>
      )}
      <div className="asst-engagement">
        <span className="muted">Overall Engagement</span>
        <div className="asst-gauge-track asst-engagement-track">
          <div className="asst-gauge-fill" style={{ width: `${Math.round(hype.score)}%` }} />
        </div>
        <span className="asst-engagement-label">{engagement}</span>
      </div>
    </div>
  );
}
