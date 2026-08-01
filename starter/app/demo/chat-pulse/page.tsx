"use client";

import { useEffect, useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents } from "@/lib/use-kick-events";

const BUCKET_MS = 10_000;
const BUCKET_COUNT = 30; // 5 minutes of 10s buckets

type ChatMsg = { id: string; username: string; content: string; color?: string };

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "it", "that", "this", "was", "and", "or", "to",
  "of", "in", "on", "for", "with", "you", "my", "me", "at", "so", "just",
]);

function topWords(messages: ChatMsg[], n: number): [string, number][] {
  const freq = new Map<string, number>();
  for (const m of messages) {
    for (const raw of m.content.toLowerCase().split(/\s+/)) {
      const word = raw.replace(/[^\p{L}\p{N}\p{Emoji}!?]/gu, "");
      if (word.length < 2 || STOP_WORDS.has(word)) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default function ChatPulsePage() {
  const [buckets, setBuckets] = useState<number[]>(Array(BUCKET_COUNT).fill(0));
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatters, setChatters] = useState<Map<string, number>>(new Map());

  const { connected } = useKickEvents((e) => {
    if (e.kind !== "chat.message.sent") return;
    const p = e.payload as Record<string, any>;
    const msg: ChatMsg = {
      id: e.id,
      username: p?.sender?.username ?? "?",
      content: String(p?.content ?? ""),
      color: p?.sender?.identity?.username_color,
    };
    setBuckets((prev) => [...prev.slice(0, -1), prev[prev.length - 1] + 1]);
    setMessages((prev) => [msg, ...prev].slice(0, 40));
    setChatters((prev) => {
      const next = new Map(prev);
      next.set(msg.username, (next.get(msg.username) ?? 0) + 1);
      return next;
    });
  });

  useEffect(() => {
    const id = setInterval(
      () => setBuckets((prev) => [...prev.slice(1), 0]),
      BUCKET_MS
    );
    return () => clearInterval(id);
  }, []);

  const max = Math.max(1, ...buckets);
  const perMinute = buckets.slice(-6).reduce((a, b) => a + b, 0);
  const topChatters = [...chatters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const trending = topWords(messages, 8);

  return (
    <PageChrome
      title="Chat Pulse"
      subtitle="Live chat analytics — message velocity, trending words, and who's carrying the conversation."
      connected={connected}
    >
      <section className="pulse-grid">
        <div className="pulse-panel pulse-wide">
          <h2>Messages / min: <span className="pulse-big">{perMinute}</span></h2>
          <div className="pulse-chart" title="last 5 minutes, 10s buckets">
            {buckets.map((count, i) => (
              <div
                key={i}
                className="pulse-bar"
                style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
              />
            ))}
          </div>
        </div>
        <div className="pulse-panel">
          <h2>Trending</h2>
          {trending.length === 0 && <p className="muted">No chat yet</p>}
          <div className="word-cloud">
            {trending.map(([word, count]) => (
              <span key={word} style={{ fontSize: `${Math.min(2, 0.85 + count * 0.15)}em` }}>
                {word}
              </span>
            ))}
          </div>
        </div>
        <div className="pulse-panel">
          <h2>Top chatters</h2>
          {topChatters.length === 0 && <p className="muted">No chat yet</p>}
          <ol className="compact-list">
            {topChatters.map(([name, count]) => (
              <li key={name}>{name} <span className="muted">×{count}</span></li>
            ))}
          </ol>
        </div>
        <div className="pulse-panel pulse-wide">
          <h2>Live chat</h2>
          <ul className="chat-list">
            {messages.length === 0 && <li className="muted">Waiting for messages…</li>}
            {messages.slice(0, 12).map((m) => (
              <li key={m.id}>
                <strong style={{ color: m.color ?? "var(--accent)" }}>{m.username}</strong>: {m.content}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PageChrome>
  );
}
