"use client";

import { useEffect, useRef, useState } from "react";
import { useKickEvents } from "@/lib/use-kick-events";
import type { ActionBet, HypeSource, Prediction, PredictionSide } from "@/lib/assistant/types";

export type PredictionView = Prediction & { odds: Record<PredictionSide, number> };
export type TopicView = { topic: string; score: number; trend: string; mentions: number };
export type HypeView = {
  score: number;
  label: string;
  velocity: number;
  breakdown: HypeSource[];
  trend: "rising" | "steady" | "falling";
  ready: boolean;
  topics: TopicView[];
};
export type MemeView = { token: string; caption?: string; at: number };
export type LineView = { text: string; at: number; kind?: string; topic?: string | null };
export type ChatView = { user: string; content: string; key: string };
export type DemoView = { playing: boolean; step: string | null; label?: string };

export type AssistantState = {
  connected: boolean;
  hype: HypeView;
  predictions: PredictionView[];
  bets: ActionBet[];
  coach: LineView[];
  summary: LineView[];
  meme: MemeView | null;
  chat: ChatView[];
  demo: DemoView;
};

const MEME_TTL_MS = 8_000;

// client-side mirror of the store's odds math (the store is server-only)
function odds(p: Prediction): Record<PredictionSide, number> {
  const total = p.pools.yes + p.pools.no;
  if (total === 0) return { yes: 50, no: 50 };
  const yes = Math.round((p.pools.yes / total) * 100);
  return { yes, no: 100 - yes };
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const next = [...list];
  next[i] = item;
  return next;
}

export function useAssistant(): AssistantState {
  const [hype, setHype] = useState<HypeView>({
    score: 0,
    label: "Quiet",
    velocity: 0,
    breakdown: [],
    trend: "steady",
    ready: false,
    topics: [],
  });
  const [predictions, setPredictions] = useState<PredictionView[]>([]);
  const [bets, setBets] = useState<ActionBet[]>([]);
  const [coach, setCoach] = useState<LineView[]>([]);
  const [summary, setSummary] = useState<LineView[]>([]);
  const [meme, setMeme] = useState<MemeView | null>(null);
  const [chat, setChat] = useState<ChatView[]>([]);
  const [demo, setDemo] = useState<DemoView>({ playing: false, step: null });
  const memeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/assistant/state")
      .then((r) => r.json())
      .then((s) => {
        setHype((prev) => ({ ...prev, ...s.hype }));
        setPredictions(s.predictions ?? []);
        setBets(s.bets ?? []);
        setDemo(s.demo ?? { playing: false, step: null });
      })
      .catch(() => {});
    return () => {
      if (memeTimer.current) clearTimeout(memeTimer.current);
    };
  }, []);

  const { connected } = useKickEvents((e) => {
    const p = e.payload as Record<string, any>;
    switch (e.kind) {
      case "assistant.hype":
        setHype({
          score: p.score,
          label: p.label,
          velocity: p.velocity,
          breakdown: p.breakdown ?? [],
          trend: p.trend ?? "steady",
          ready: p.ready ?? false,
          topics: p.topics ?? [],
        });
        return;
      case "assistant.coach":
        setCoach((prev) =>
          [{ text: p.text, at: p.at ?? Date.now(), kind: p.kind, topic: p.topic }, ...prev].slice(0, 6),
        );
        return;
      case "assistant.summary":
        setSummary((prev) => [{ text: p.text, at: p.at ?? Date.now() }, ...prev].slice(0, 12));
        return;
      case "assistant.meme":
        setMeme({ token: p.token, caption: p.caption, at: p.at ?? Date.now() });
        if (memeTimer.current) clearTimeout(memeTimer.current);
        memeTimer.current = setTimeout(() => setMeme(null), MEME_TTL_MS);
        return;
      case "assistant.demo":
        setDemo(
          p.status === "done"
            ? { playing: false, step: null }
            : { playing: true, step: p.step, label: p.label },
        );
        return;
      case "assistant.prediction.created":
      case "assistant.prediction.settled":
        setPredictions((prev) => upsert(prev, { ...(p as Prediction), odds: odds(p as Prediction) }));
        return;
      case "assistant.prediction.wager": {
        const prediction = p.prediction as Prediction;
        setPredictions((prev) => upsert(prev, { ...prediction, odds: odds(prediction) }));
        return;
      }
      case "assistant.bet.created":
      case "assistant.bet.accepted":
      case "assistant.bet.declined":
      case "assistant.bet.watching":
      case "assistant.bet.validated":
      case "assistant.bet.paid":
      case "assistant.bet.impact":
        setBets((prev) => upsert(prev, p as ActionBet));
        return;
      case "chat.message.sent":
        setChat((prev) =>
          [...prev, { user: p?.sender?.username ?? "viewer", content: String(p?.content ?? ""), key: e.id }].slice(-14),
        );
        return;
    }
  });

  return { connected, hype, predictions, bets, coach, summary, meme, chat, demo };
}

/* ---------- fetch helpers shared by the assistant pages ---------- */

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

export const assistantApi = {
  createPrediction: (question: string, durationMinutes = 60) =>
    post("/api/assistant/predictions", { question, durationMinutes }),
  placeWager: (id: string, user: string, side: PredictionSide, amount: number) =>
    post(`/api/assistant/predictions/${id}/wager`, { user, side, amount }),
  createBet: (user: string, wager: number, condition: string) =>
    post("/api/assistant/bets", { user, wager, condition }),
  betAction: (id: string, action: "accept" | "decline" | "validate") =>
    post(`/api/assistant/bets/${id}`, { action }),
  demo: (action: "play" | "stop" | "burst67") => post("/api/assistant/demo", { action }),
};
