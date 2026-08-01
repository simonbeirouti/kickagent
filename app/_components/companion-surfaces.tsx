"use client";

import {
  ActivityIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  GlassesIcon,
  LockKeyholeIcon,
  MessageCircleIcon,
  Mic2Icon,
  RadioIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { useDemoOverlayState } from "@/lib/demo-overlay-store";
import type { OverlayState } from "@/lib/overlay-state";

type PhonePanel = "brief" | "chat" | "notes";

export function GlassesSurface({ state: initialState }: { readonly state: OverlayState }) {
  const state = useDemoOverlayState(initialState);
  const [cueIndex, setCueIndex] = useState(0);
  const privateContext = state.privateContext;
  const glassesCues = state.surfaceContent?.glassesCues ?? [];
  const activeCue = glassesCues[cueIndex] ?? state.suggestion?.text ?? "Waiting for a suggestion…";

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

      <section aria-live="polite" className="glasses-cue-card">
        <div className="glasses-cue-meta">
          <span><SparklesIcon size={16} /> Agent suggestion</span>
          <span className="glasses-listening"><i /> Listening</span>
        </div>
        <p>{activeCue}</p>
        <footer>
          <span>Based on live chat</span>
          <button
            onClick={() => setCueIndex((current) => (current + 1) % Math.max(1, glassesCues.length))}
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
      </div>
    </main>
  );
}

export function StreamerPhoneSurface({ state: initialState }: { readonly state: OverlayState }) {
  const state = useDemoOverlayState(initialState);
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
