"use client";

import {
  MessageCircleIcon,
  RadioIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { OverlayCanvas } from "@/app/_components/overlay-canvas";
import { useLiveOverlayState } from "@/lib/live-overlay-store";

type PhonePanel = "brief" | "chat" | "summary" | "widgets";

export function StreamerPhoneSurface() {
  const liveState = useLiveOverlayState();
  // Hook order must not depend on whether live state has arrived yet.
  const [panel, setPanel] = useState<PhonePanel>("brief");
  if (!liveState.state) return <SurfaceStatus error={liveState.error} />;
  const state = liveState.state;
  const topics = state.summary?.topics ?? [];
  const phoneLayout = state.screenLayouts?.phone ?? [];
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
            {(["brief", "chat", "summary", "widgets"] as const).map((item) => (
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

            {panel === "widgets" ? (
              <section className="phone-widgets-card">
                <span className="phone-section-label"><ZapIcon size={13} /> Your arranged widgets</span>
                {phoneLayout.length === 0 ? (
                  <p>Arrange widgets for the phone screen in the overlay studio.</p>
                ) : (
                  <div className="phone-widgets-stage">
                    <OverlayCanvas
                      embedded
                      layout={phoneLayout}
                      publicMode
                      screen="phone"
                      state={state}
                    />
                  </div>
                )}
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
