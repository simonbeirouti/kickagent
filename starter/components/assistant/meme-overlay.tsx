"use client";

import type { HypeView, MemeView } from "@/lib/assistant/use-assistant";

export default function MemeOverlay({ meme, hype }: { meme: MemeView | null; hype: HypeView }) {
  if (!meme) return null;
  const flames = "🔥".repeat(Math.max(1, Math.min(5, Math.ceil(hype.score / 20))));

  return (
    <div className="asst-meme">
      <div className="asst-meme-caption">{meme.caption ?? `Chat is spamming “${meme.token}”!`}</div>
      <div className="asst-meme-body">
        <span className="asst-meme-token">{meme.token}</span>
        <span className="asst-meme-frog">🐸</span>
      </div>
      <div className="asst-meme-level">HYPE LEVEL: {flames}</div>
    </div>
  );
}
