"use client";

import {
  ActivityIcon,
  FlameIcon,
  GlassesIcon,
  LockKeyholeIcon,
  MessageCircleIcon,
  RadioIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { useLiveOverlayState } from "@/lib/live-overlay-store";
import type { OverlayState } from "@/lib/overlay-state";

type PhonePanel = "brief" | "chat" | "summary";

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function GlassesSurface() {
  const liveState = useLiveOverlayState();
  if (!liveState.state) return <SurfaceStatus error={liveState.error} />;
  const state = liveState.state;
  return (
    <main className="glasses-surface">
      <div className="glasses-vignette" aria-hidden />
      <header className="glasses-topbar">
        <span className="glasses-mode"><GlassesIcon size={15} /> {state.channel.displayName}</span>
        <span className="glasses-live"><i /> {state.live ? "Live" : "Offline"}</span>
      </header>

      <section aria-label="Live summary" className="glasses-private-card">
        <div className="glasses-card-label"><LockKeyholeIcon size={14} /> Live summary</div>
        <strong>{state.summary?.text ?? "Waiting for the first agent brief…"}</strong>
        <p>{formatTopics(state.summary?.topics)}</p>
      </section>

      {state.prediction || state.activeBet ? (
        <section aria-label="Live prediction market" className="glasses-prediction-card">
          <div className="glasses-card-label"><TrendingUpIcon size={14} /> Live prediction</div>
          {state.prediction ? (
            <>
              <strong>{state.prediction.question}</strong>
              <div className="glasses-prediction-split">
                <div className="glasses-prediction-yes">
                  <span>YES {state.prediction.yesPercent}%</span>
                  <small>{formatMoney(state.prediction.yesPool)}</small>
                </div>
                <div className="glasses-prediction-no">
                  <span>NO {100 - state.prediction.yesPercent}%</span>
                  <small>{formatMoney(state.prediction.noPool)}</small>
                </div>
              </div>
            </>
          ) : null}
          {state.activeBet ? (
            <div className="glasses-prediction-bet">
              <FlameIcon size={13} /> {state.activeBet.text} · {formatMoney(state.activeBet.amount)} ·{" "}
              {state.activeBet.status}
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-live="polite" className="glasses-cue-card">
        <div className="glasses-cue-meta">
          <span><SparklesIcon size={16} /> Agent suggestion</span>
          <span className="glasses-listening"><i /> {state.connected ? "Connected" : "Disconnected"}</span>
        </div>
        <p>{state.suggestion?.text ?? "Listening for a useful moment…"}</p>
        <footer>
          <span>{suggestionBasis(state)}</span>
          <span>{relativeTime(state.suggestion?.generatedAt ?? state.updatedAt)}</span>
        </footer>
      </section>

      <div className="glasses-reticle" aria-hidden><span /></div>
      <div className="glasses-bottom-status">
        <span><ActivityIcon size={14} /> Hype {state.hypeScore}</span>
        {state.activeBet ? (
          <span>
            <FlameIcon size={14} /> Bet {formatMoney(state.activeBet.amount)} · {state.activeBet.status}
          </span>
        ) : null}
      </div>
    </main>
  );
}

export function StreamerPhoneSurface() {
  const liveState = useLiveOverlayState();
  const [panel, setPanel] = useState<PhonePanel>("brief");
  if (!liveState.state) return <SurfaceStatus error={liveState.error} />;
  const state = liveState.state;
  const topics = state.summary?.topics ?? [];
  return (
    <main className="phone-demo-stage">
      <div className="phone-device">
        <div className="phone-island" aria-hidden />
        <div className="phone-screen">
          <header className="phone-header">
            <div className="phone-channel">
              <span className="phone-avatar">K</span>
              <span><small>{state.channel.streamTitle || "Untitled stream"}</small><strong>{state.channel.displayName}</strong></span>
            </div>
            <span className="phone-live"><i /> {state.live ? "Live" : "Offline"}</span>
          </header>

          <section className="phone-pulse-card">
            <div>
              <span className="phone-section-label"><RadioIcon size={13} /> Agent energy</span>
              <strong>{state.hypeScore}</strong>
              <small>{energyLabel(state.hypeScore)}</small>
            </div>
            <div className="phone-pulse-bars" aria-hidden>
              {pulseBars(state.hypeScore).map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <span className="phone-viewers"><UsersIcon size={13} /> {state.messages.length} recent</span>
          </section>

          <nav aria-label="Phone information panels" className="phone-tabs">
            {(["brief", "chat", "summary"] as const).map((item) => (
              <button
                aria-label={`${item}${item === "chat" ? `, ${state.messages.length} messages` : ""}`}
                className={panel === item ? "active" : undefined}
                key={item}
                onClick={() => setPanel(item)}
                type="button"
              >
                {item}
                {item === "chat" ? <span>{state.messages.length}</span> : null}
              </button>
            ))}
          </nav>

          <div className="phone-panel" aria-live="polite">
            {panel === "brief" ? (
              <>
                <section className="phone-suggestion-card">
                  <div className="phone-card-heading">
                    <span><SparklesIcon size={15} /> Say this next</span>
                    <small>{relativeTime(state.suggestion?.generatedAt ?? state.updatedAt)}</small>
                  </div>
                  <p>{state.suggestion?.text ?? "Listening for a useful moment…"}</p>
                </section>
                <section className="phone-topic-card">
                  <span className="phone-section-label"><ZapIcon size={13} /> Chat is leaning into</span>
                  {topics.length === 0 ? <p>Waiting for live chat signals…</p> : topics.map((topic, index) => (
                    <div className={index === 0 ? "phone-topic-item" : "phone-topic-item secondary"} key={topic.label}>
                      <div className="phone-topic-row"><strong>{topic.label}</strong><span>{topic.percentage}%</span></div>
                      <div className="phone-topic-meter"><i style={{ width: `${topic.percentage}%` }} /></div>
                    </div>
                  ))}
                </section>
              </>
            ) : null}

            {panel === "chat" ? (
              <section className="phone-chat-card">
                <span className="phone-section-label"><MessageCircleIcon size={13} /> Live chat</span>
                {state.messages.length === 0 ? <p>Waiting for chat…</p> : state.messages.map((message) => (
                  <div className="phone-message" key={message.id}>
                    <span>{message.username.slice(0, 1).toUpperCase()}</span>
                    <p><strong>{message.username}</strong>{message.content}</p>
                  </div>
                ))}
              </section>
            ) : null}

            {panel === "summary" ? (
              <section className="phone-notes-card">
                <span className="phone-section-label"><ShieldAlertIcon size={13} /> Agent live summary</span>
                <h2>{state.summary?.text ?? "Waiting for the first agent brief…"}</h2>
                {topics.length > 0 ? <ul>{topics.map((topic) => <li key={topic.label}>{topic.label}</li>)}</ul> : null}
              </section>
            ) : null}
          </div>

          <footer className="phone-footer">
            <span><i /> {state.connected ? "Connected" : "Disconnected"}</span>
            <span>{state.channel.category || "No category"}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}

function SurfaceStatus({ error }: { readonly error?: string }) {
  return (
    <main className="connect-screen">
      <div className="connect-card">
        <div className="kick-mark">K</div>
        <p className="eyebrow">Live streamer companion</p>
        <h1>{error ?? "Connecting to live stream…"}</h1>
        {error ? <a className="connect-button" href="/api/auth/kick/start">Connect Kick<span aria-hidden>→</span></a> : null}
      </div>
    </main>
  );
}

function formatTopics(topics: readonly { readonly label: string }[] | undefined): string {
  return topics && topics.length > 0
    ? topics.map((topic) => topic.label).join(" · ")
    : "Waiting for live chat signals";
}

function suggestionBasis(state: OverlayState): string {
  if (state.suggestion?.basis === "chat") return "Based on live chat";
  if (state.suggestion?.basis === "stream_context") return "Based on stream context";
  return "Waiting for context";
}

function pulseBars(score: number): number[] {
  const floor = Math.max(12, Math.round(score * 0.35));
  return [0.55, 0.8, 0.63, 1, 0.72, 0.92, 0.68, 0.58, 0.76, 0.96, 0.61, 0.84]
    .map((factor) => Math.min(100, Math.max(10, Math.round(floor + score * factor * 0.55))));
}

function energyLabel(score: number): string {
  if (score >= 80) return "High energy";
  if (score >= 55) return "Building momentum";
  return score > 0 ? "Room is warming up" : "Waiting for analysis";
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1_000));
  return seconds < 5 ? "now" : seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
}
