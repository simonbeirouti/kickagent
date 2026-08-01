"use client";

import type { ActionBet } from "@/lib/assistant/types";
import { assistantApi } from "@/lib/assistant/use-assistant";

const STATUS_LABEL: Record<ActionBet["status"], string> = {
  open: "PENDING",
  accepted: "ACCEPTED",
  declined: "IGNORED",
  watching: "AI WATCHING",
  validated: "VALIDATED ✅",
  paid: "PAID 💸",
  expired: "EXPIRED",
};

export default function BetCard({
  bet,
  variant = "overlay",
}: {
  bet: ActionBet;
  variant?: "hud" | "overlay";
}) {
  return (
    <div className={`asst-bet asst-bet-${bet.status}`}>
      <div className="asst-bet-head">
        <span>🎯 @{bet.user} bet {bet.wager} KICKs</span>
        <span className={`asst-pill asst-pill-${bet.status}`}>{STATUS_LABEL[bet.status]}</span>
      </div>
      <div className="asst-bet-cond">{bet.condition}</div>
      {variant === "hud" && bet.status === "open" && (
        <div className="row">
          <button className="primary" onClick={() => assistantApi.betAction(bet.id, "accept")}>
            Accept
          </button>
          <button onClick={() => assistantApi.betAction(bet.id, "decline")}>Ignore</button>
        </div>
      )}
      {variant === "hud" && bet.status === "accepted" && (
        <div className="row">
          <button onClick={() => assistantApi.betAction(bet.id, "validate")}>
            🤖 Send AI to validate
          </button>
        </div>
      )}
      {bet.status === "paid" && (
        <div className="asst-bet-payout">Payout sent: {bet.wager * 2} KICKs → @{bet.user}</div>
      )}
      {bet.impact && (
        <div className={`asst-bet-impact asst-impact-${bet.impact.verdict}`}>
          {bet.impact.verdict === "up" ? "▲" : bet.impact.verdict === "down" ? "▼" : "▬"} Hype
          impact: {bet.impact.delta >= 0 ? "+" : ""}
          {bet.impact.delta} ({bet.impact.preHype} → {bet.impact.postHype})
        </div>
      )}
    </div>
  );
}
