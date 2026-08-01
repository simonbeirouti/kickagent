"use client";

import {
  ActivityIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  FlameIcon,
  GlassesIcon,
  LockKeyholeIcon,
  MessageCircleIcon,
  Mic2Icon,
  RadioIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import type { OverlayState } from "@/lib/overlay-state";

const GLASSES_CUES = [
  "Ask chat what information they would want in their glasses during a live stream.",
  "Mika's message is getting traction — ask the room whether the glasses should feel invisible or expressive.",
  "Pause after the reveal and let chat react before moving to the phone view.",
] as const;

type PhonePanel = "brief" | "chat" | "notes";

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function GlassesSurface({ state }: { readonly state: OverlayState }) {
  const [cueIndex, setCueIndex] = useState(0);
  const privateContext = state.privateContext;

  return (
    <main className="glasses-surface">
      <div className="glasses-vignette" aria-hidden />
      <header className="glasses-topbar">
        <a aria-label="Back to dashboard" className="surface-back" href="/">
          <ArrowLeftIcon size={15} />
          Studio
        </a>
        <span className="glasses-mode"><GlassesIcon size={15} /> Glasses preview</span>
        <span className="glasses-live"><i /> LIVE · 42:18</span>
      </header>

      <section aria-label="Private information" className="glasses-private-card">
        <div className="glasses-card-label"><LockKeyholeIcon size={14} /> Only you can see this</div>
        <strong>{privateContext?.headline ?? "Private stream context"}</strong>
        <p>{privateContext?.notes[0] ?? "Your private notes will appear here."}</p>
      </section>

      {state.prediction ? (
        <section aria-label="Live prediction market" className="glasses-prediction-card">
          <div className="glasses-card-label"><TrendingUpIcon size={14} /> Live prediction</div>
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
        </section>
      ) : null}

      <section aria-live="polite" className="glasses-cue-card">
        <div className="glasses-cue-meta">
          <span><SparklesIcon size={16} /> Agent suggestion</span>
          <span className="glasses-listening"><i /> Listening</span>
        </div>
        <p>{GLASSES_CUES[cueIndex]}</p>
        <footer>
          <span>Based on live chat</span>
          <button
            onClick={() => setCueIndex((current) => (current + 1) % GLASSES_CUES.length)}
            type="button"
          >
            Next cue <ChevronRightIcon size={15} />
          </button>
        </footer>
      </section>

      <div className="glasses-reticle" aria-hidden><span /></div>
      <div className="glasses-bottom-status">
        <span><Mic2Icon size={14} /> Voice active</span>
        <span><EyeIcon size={14} /> Private display</span>
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

export function StreamerPhoneSurface({ state }: { readonly state: OverlayState }) {
  const [panel, setPanel] = useState<PhonePanel>("brief");
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const privateContext = state.privateContext;

  return (
    <main className="phone-demo-stage">
      <a className="phone-stage-back" href="/"><ArrowLeftIcon size={15} /> Back to studio</a>
      <div className="phone-device">
        <div className="phone-island" aria-hidden />
        <div className="phone-screen">
          <header className="phone-header">
            <div className="phone-channel">
              <span className="phone-avatar">K</span>
              <span><small>Live companion</small><strong>{state.channel.displayName}</strong></span>
            </div>
            <span className="phone-live"><i /> Live</span>
          </header>

          <section className="phone-pulse-card">
            <div>
              <span className="phone-section-label"><RadioIcon size={13} /> Stream pulse</span>
              <strong>{state.hypeScore}</strong>
              <small>High energy</small>
            </div>
            <div className="phone-pulse-bars" aria-hidden>
              {[38, 62, 46, 82, 56, 95, 72, 48, 68, 88, 54, 76].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <span className="phone-viewers"><UsersIcon size={13} /> 1.8K</span>
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
                    <span><SparklesIcon size={15} /> Say this next</span>
                    <small>Just now</small>
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
                  <span className="phone-section-label"><ZapIcon size={13} /> Chat is leaning into</span>
                  <div className="phone-topic-row"><strong>Glasses privacy</strong><span>38%</span></div>
                  <div className="phone-topic-meter"><i /></div>
                  <div className="phone-topic-row secondary"><strong>Phone controls</strong><span>24%</span></div>
                </section>
              </>
            ) : null}

            {panel === "chat" ? (
              <section className="phone-chat-card">
                <span className="phone-section-label"><MessageCircleIcon size={13} /> Recent signals</span>
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
                <span className="phone-section-label"><ShieldAlertIcon size={13} /> Private notes</span>
                <h2>{privateContext?.headline}</h2>
                <ul>
                  {privateContext?.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </section>
            ) : null}
          </div>

          <footer className="phone-footer">
            <span><i /> Agent connected</span>
            <span>{state.channel.category}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
