"use client";

import {
  CheckIcon,
  ChevronRightIcon,
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
import { useDemoOverlayState } from "@/lib/demo-overlay-store";
import type { OverlayState } from "@/lib/overlay-state";

type PhonePanel = "brief" | "chat" | "notes";

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function GlassesSurface({ state: initialState }: { readonly state: OverlayState }) {
  const state = useDemoOverlayState(initialState);
  const [cueIndex, setCueIndex] = useState(0);
  const privateContext = state.privateContext;
  const glassesCues = state.surfaceContent?.glassesCues ?? [];
  const labels = state.surfaceContent?.widgetLabels;
  const activeCue = glassesCues[cueIndex] ?? state.suggestion?.text ?? "";

  return (
    <main className="glasses-surface">
      <div className="glasses-vignette" aria-hidden />
      <header className="glasses-topbar">
        <span className="glasses-mode"><GlassesIcon size={15} /> {state.channel.displayName}</span>
        <span className="glasses-live"><i /> {state.live ? "Live" : "Offline"}</span>
      </header>

      <section aria-label="Private information" className="glasses-private-card">
        <div className="glasses-card-label"><LockKeyholeIcon size={14} /> {labels?.glassesPrivate}</div>
        <strong>{privateContext?.headline ?? ""}</strong>
        <p>{privateContext?.notes[0] ?? ""}</p>
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
          <span><SparklesIcon size={16} /> {labels?.glassesSuggestion}</span>
          <span className="glasses-listening"><i /> {state.connected ? "Connected" : "Disconnected"}</span>
        </div>
        <p>{activeCue}</p>
        <footer>
          <span>{suggestionBasis(state)}</span>
          <button
            onClick={() => setCueIndex((current) => (current + 1) % Math.max(1, glassesCues.length))}
            type="button"
          >
            Next cue <ChevronRightIcon size={15} />
          </button>
        </footer>
      </section>

      <div className="glasses-reticle" aria-hidden><span /></div>
    </main>
  );
}

export function StreamerPhoneSurface({ state: initialState }: { readonly state: OverlayState }) {
  const state = useDemoOverlayState(initialState);
  const [panel, setPanel] = useState<PhonePanel>("brief");
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const privateContext = state.privateContext;
  const labels = state.surfaceContent?.widgetLabels;

  return (
    <main className="phone-demo-stage">
      <div className="phone-device">
        <div className="phone-island" aria-hidden />
        <div className="phone-screen">
          <header className="phone-header">
            <div className="phone-channel">
              <span className="phone-avatar">K</span>
              <span><small>{state.channel.streamTitle}</small><strong>{state.channel.displayName}</strong></span>
            </div>
            <span className="phone-live"><i /> {state.live ? "Live" : "Offline"}</span>
          </header>

          <section className="phone-pulse-card">
            <div>
              <span className="phone-section-label"><RadioIcon size={13} /> {labels?.phonePulse}</span>
              <strong>{state.hypeScore}</strong>
              <small>{energyLabel(state.hypeScore)}</small>
            </div>
            <div className="phone-pulse-bars" aria-hidden>
              {[38, 62, 46, 82, 56, 95, 72, 48, 68, 88, 54, 76].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <span className="phone-viewers"><UsersIcon size={13} /> {state.surfaceContent?.viewerCount}</span>
          </section>

          <nav aria-label="Phone information panels" className="phone-tabs">
            {(["brief", "chat", "notes"] as const).map((item) => (
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
                    <span><SparklesIcon size={15} /> {labels?.phoneSuggestion}</span>
                    <small>{relativeTime(state.updatedAt)}</small>
                  </div>
                  <p>{state.suggestion?.text}</p>
                  <button
                    className={suggestionUsed ? "used" : undefined}
                    onClick={() => setSuggestionUsed((current) => !current)}
                    type="button"
                  >
                    <CheckIcon size={14} /> {suggestionUsed ? "Used" : "Mark used"}
                  </button>
                </section>
                <section className="phone-topic-card">
                  <span className="phone-section-label"><ZapIcon size={13} /> {labels?.phoneTopics}</span>
                  {(state.surfaceContent?.phoneTopics ?? []).map((topic, index) => (
                    <div className={index === 0 ? "phone-topic-item" : "phone-topic-item secondary"} key={`${index}-${topic.label}`}>
                      <div className="phone-topic-row"><strong>{topic.label}</strong><span>{topic.percentage}%</span></div>
                      <div className="phone-topic-meter"><i style={{ width: `${topic.percentage}%` }} /></div>
                    </div>
                  ))}
                </section>
              </>
            ) : null}

            {panel === "chat" ? (
              <section className="phone-chat-card">
                <span className="phone-section-label"><MessageCircleIcon size={13} /> {labels?.publicChat}</span>
                {state.messages.map((message) => (
                  <div className="phone-message" key={message.id}>
                    <span>{message.username.slice(0, 1).toUpperCase()}</span>
                    <p><strong>{message.username}</strong>{message.content}</p>
                  </div>
                ))}
              </section>
            ) : null}

            {panel === "notes" ? (
              <section className="phone-notes-card">
                <span className="phone-section-label"><ShieldAlertIcon size={13} /> {labels?.glassesPrivate}</span>
                <h2>{privateContext?.headline}</h2>
                <ul>
                  {privateContext?.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </section>
            ) : null}
          </div>

          <footer className="phone-footer">
            <span><i /> {state.connected ? "Connected" : "Disconnected"}</span>
            <span>{state.channel.category}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}

function suggestionBasis(state: OverlayState): string {
  if (state.suggestion?.basis === "chat") return "Based on live chat";
  if (state.suggestion?.basis === "stream_context") return "Based on stream context";
  return "Waiting for context";
}

function energyLabel(score: number): string {
  if (score >= 80) return "High energy";
  if (score >= 55) return "Building momentum";
  return "Room is warming up";
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1_000));
  return seconds < 5 ? "now" : seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
}
