"use client";

import type { ActionBet } from "@/lib/assistant/types";

const STEPS = [
  { key: "watching", icon: "👁", label: "Analyzing stream…" },
  { key: "validated", icon: "✅", label: "Event detected" },
  { key: "paid", icon: "💸", label: "Payout sent" },
] as const;

const RANK: Partial<Record<ActionBet["status"], number>> = {
  watching: 0,
  validated: 1,
  paid: 2,
};

/** The AI agent's outcome-validation pipeline for the most advanced bet. */
export default function ValidationTicker({ bets }: { bets: ActionBet[] }) {
  const bet = [...bets].sort((a, b) => (RANK[b.status] ?? -1) - (RANK[a.status] ?? -1))[0];
  const rank = bet ? (RANK[bet.status] ?? -1) : -1;

  return (
    <div className="asst-panel">
      <div className="asst-panel-head">
        <span className="asst-kicker">🤖 Outcome Validation</span>
        <span className="asst-ai-badge">AI AGENT</span>
      </div>
      <ol className="asst-ticker-steps">
        {STEPS.map((step, i) => (
          <li
            key={step.key}
            className={i < rank ? "asst-step-done" : i === rank ? "asst-step-active" : ""}
          >
            <span className="asst-step-icon">{step.icon}</span>
            <span>
              {step.key === "paid" && bet?.status === "paid"
                ? `Payout sent: ${bet.wager * 2} KICKs to @${bet.user}`
                : step.label}
            </span>
          </li>
        ))}
      </ol>
      {!bet && <p className="muted">Accept a bet and send the AI to watch the stream.</p>}
    </div>
  );
}
