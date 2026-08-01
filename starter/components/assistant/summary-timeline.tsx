"use client";

import type { LineView } from "@/lib/assistant/use-assistant";

const time = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function SummaryTimeline({ summary }: { summary: LineView[] }) {
  return (
    <div className="asst-panel">
      <div className="asst-panel-head">
        <span className="asst-kicker">📋 Live Summary</span>
        <span className="asst-ai-badge">AI</span>
      </div>
      {summary.length === 0 ? (
        <p className="muted">Nothing yet — the agent narrates the stream here.</p>
      ) : (
        <ul className="asst-timeline">
          {summary.map((line, i) => (
            <li key={`${line.at}-${i}`}>
              <span className="asst-timeline-time">{time(line.at)}</span>
              <span>{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
