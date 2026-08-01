"use client";

/**
 * /overlay — demo stream overlay driven by the hype engine.
 *
 * Runs the deterministic ~4.5-min scripted replay (hype-engine/src/mock.js)
 * on a client-side clock, samples the engine at 4 Hz, and renders:
 *   - the 0–100 hype meter (rAF-interpolated ring, matches the dashboard's look)
 *   - top chat topics with per-topic momentum
 *   - assistant events (baseline ready, pivot suggestions, bet impact) as toasts
 *   - live chat ticker + spam-shield flags
 *
 * OBS: add `?transparent=1` for a transparent page background.
 * Loops forever, so it can sit on stream unattended.
 */

import {
  ActivityIcon,
  FlameIcon,
  MessageCircleIcon,
  RadioIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Plain-JS ES modules; tsconfig has allowJs + the @/* alias, so they import as-is.
import { KickAssistant } from "@/hype-engine/src/assistant.js";
import { HypeEngine } from "@/hype-engine/src/engine.js";
import { createScriptedReplay } from "@/hype-engine/src/mock.js";
import { TopicTracker } from "@/hype-engine/src/topics.js";

const SAMPLE_MS = 250; // 4 Hz
const REPLAY_END_MS = 272_000;
const DARE_AT_MS = 171_000; // streamer takes the "Hit Me, Kick Me" dare in the script
const TOAST_TTL_MS = 12_000;

const PHASES: readonly { until: number; label: string }[] = [
  { until: 50_000, label: "Warm-up" },
  { until: 100_000, label: "Ramp" },
  { until: 120_000, label: "Spam attack" },
  { until: 170_000, label: "Lull" },
  { until: 220_000, label: "Hit Me, Kick Me" },
  { until: Infinity, label: "Cooldown" },
];

interface Toast {
  readonly id: string;
  readonly kind: "ready" | "suggestion" | "impact";
  readonly text: string;
  readonly ts: number;
}

interface TopicRow {
  readonly topic: string;
  readonly score: number;
  readonly trend: string;
}

interface ChatLine {
  readonly id: string;
  readonly username: string;
  readonly text: string;
}

// KICK webhook-shaped replay event (see hype-engine/src/mock.js).
interface ReplayEvent {
  readonly id: string;
  readonly type: string;
  readonly userId: string;
  readonly username: string;
  readonly text?: string;
  readonly ts: number;
}

interface OverlaySnapshot {
  readonly hype: number;
  readonly trend: string;
  readonly ready: boolean;
  readonly topics: readonly TopicRow[];
  readonly toasts: readonly Toast[];
  readonly messages: readonly ChatLine[];
  readonly flaggedCount: number;
  readonly phase: string;
  readonly elapsed: number;
}

export default function OverlayPage() {
  const [snap, setSnap] = useState<OverlaySnapshot>();
  const [displayHype, setDisplayHype] = useState(0);
  const [transparent, setTransparent] = useState(false);
  const targetHype = useRef(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("transparent") === "1") {
      setTransparent(true);
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    }
  }, []);

  useEffect(() => {
    let engine: HypeEngine;
    let topics: TopicTracker;
    let assistant: KickAssistant;
    let events: ReplayEvent[];
    let idx = 0;
    let startedAt = 0;
    let dareTracked = false;
    let toasts: Toast[] = [];
    let messages: ChatLine[] = [];

    const pushToast = (kind: Toast["kind"], text: string, ts: number) => {
      toasts = [...toasts.slice(-3), { id: `${kind}-${ts}`, kind, text, ts }];
    };

    const reset = () => {
      engine = new HypeEngine();
      topics = new TopicTracker();
      assistant = new KickAssistant(engine, topics);
      assistant
        .on("ready", (p: { message: string; ts: number }) => pushToast("ready", p.message, p.ts))
        .on("suggestion", (p: { text: string; ts: number }) => pushToast("suggestion", p.text, p.ts))
        .on("impact", (p: { label: string; delta: number; verdict: string; ts: number }) =>
          pushToast(
            "impact",
            `${p.label}: hype ${p.delta >= 0 ? "+" : ""}${p.delta} — ${p.verdict.toUpperCase()}`,
            p.ts,
          ),
        );
      events = createScriptedReplay();
      idx = 0;
      dareTracked = false;
      toasts = [];
      messages = [];
      startedAt = performance.now();
    };

    reset();

    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      if (elapsed > REPLAY_END_MS) {
        reset();
        return;
      }

      // Feed every event whose timestamp has passed on the replay clock.
      while (idx < events.length && events[idx].ts <= elapsed) {
        const ev = events[idx++];
        const w = engine.ingest(ev);
        if (ev.type === "chat") {
          // Flagged spammers add (saturated) energy but can't push topics.
          if (!engine.isFlagged(ev.userId)) topics.ingest(ev, w);
          messages = [...messages.slice(-5), { id: ev.id, username: ev.username, text: ev.text ?? "" }];
        }
      }

      // Scripted "Hit Me, Kick Me" moment: measure the dare's hype impact.
      if (!dareTracked && elapsed >= DARE_AT_MS) {
        dareTracked = true;
        assistant.trackAction("Hit Me, Kick Me", elapsed);
      }

      const state = engine.sample(elapsed);
      assistant.onSample(state, elapsed);
      toasts = toasts.filter((t) => elapsed - t.ts < TOAST_TTL_MS);

      targetHype.current = state.hype;
      setSnap({
        hype: state.hype,
        trend: state.trend,
        ready: state.ready,
        topics: topics.top(5, elapsed),
        toasts,
        messages,
        flaggedCount: state.flaggedUsers.length,
        phase: PHASES.find((p) => elapsed < p.until)?.label ?? "Cooldown",
        elapsed,
      });
    }, SAMPLE_MS);

    return () => window.clearInterval(timer);
  }, []);

  // Smooth the meter between 4 Hz samples.
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setDisplayHype((prev) => {
        const next = prev + (targetHype.current - prev) * 0.1;
        return Math.abs(next - targetHype.current) < 0.05 ? targetHype.current : next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!snap) {
    return (
      <main className="connect-screen">
        <div className="loading-pulse" />
      </main>
    );
  }

  const shown = Math.round(displayHype);

  return (
    <main className={transparent ? "overlay-shell demo-transparent" : "overlay-shell"}>
      <header className="overlay-header">
        <div className="channel-identity">
          <span className="channel-avatar channel-avatar-fallback">K</span>
          <div>
            <p className="eyebrow">Hype tracker — mock replay</p>
            <h1>
              {snap.phase} · {formatClock(snap.elapsed)}
            </h1>
          </div>
        </div>
        <div className="header-actions">
          <span className={snap.ready ? "status-pill live" : "status-pill offline"}>
            <span className="status-dot" />
            {snap.ready ? "Baseline locked" : "Calibrating…"}
          </span>
        </div>
      </header>

      <section className="widget-grid demo-grid">
        <article className="widget hype-widget">
          <header className="widget-header">
            <span className="widget-title">
              <ActivityIcon size={17} />
              Hype score
            </span>
            <TrendBadge trend={snap.trend} />
          </header>
          <div className="hype-content">
            <div
              aria-label={`Hype score ${shown} out of 100`}
              className="hype-ring"
              style={{ "--hype": `${displayHype * 3.6}deg` } as React.CSSProperties}
            >
              <strong>{shown}</strong>
              <span>/ 100</span>
            </div>
            <div className="hype-copy">
              <ZapIcon size={18} />
              <span>{hypeLabel(shown)}</span>
            </div>
          </div>
          {snap.flaggedCount > 0 ? (
            <footer className="widget-footer">
              <span className="spam-flag">
                <ShieldAlertIcon size={12} /> {snap.flaggedCount} spammer
                {snap.flaggedCount === 1 ? "" : "s"} muted from topics
              </span>
            </footer>
          ) : null}
        </article>

        <article className="widget">
          <header className="widget-header">
            <span className="widget-title">
              <FlameIcon size={17} />
              Chat topics
            </span>
            <span className="count-badge">top {snap.topics.length}</span>
          </header>
          <div className="topic-list">
            {snap.topics.length === 0 ? (
              <div className="empty-messages">
                <RadioIcon size={20} />
                <span>Listening for topics…</span>
              </div>
            ) : (
              snap.topics.map((t) => (
                <div className="topic-row" key={t.topic}>
                  <span className="topic-name">{t.topic}</span>
                  <span className="topic-bar">
                    <span
                      className="topic-bar-fill"
                      style={{ width: `${Math.min(100, t.score * 12)}%` }}
                    />
                  </span>
                  <TrendBadge trend={t.trend} />
                </div>
              ))
            )}
          </div>
        </article>

        <article className="widget">
          <header className="widget-header">
            <span className="widget-title">
              <MessageCircleIcon size={17} />
              Chat
            </span>
          </header>
          <div className="message-list demo-messages">
            {snap.messages.map((m) => (
              <div className="chat-message" key={m.id}>
                <span className="chat-user">{m.username}</span>
                <span className="chat-copy">{m.text}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <div className="toast-stack" role="status">
        {snap.toasts.map((toast) => (
          <div className={`toast toast-${toast.kind}`} key={toast.id}>
            <SparklesIcon size={15} />
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      <style>{demoStyles}</style>
    </main>
  );
}

function TrendBadge({ trend }: { readonly trend: string }) {
  if (trend === "rising")
    return (
      <span className="trend-badge rising">
        <TrendingUpIcon size={13} /> rising
      </span>
    );
  if (trend === "falling")
    return (
      <span className="trend-badge falling">
        <TrendingDownIcon size={13} /> falling
      </span>
    );
  return <span className="trend-badge">steady</span>;
}

function hypeLabel(hype: number): string {
  if (hype >= 75) return "Chat is ERUPTING";
  if (hype >= 50) return "Great energy";
  if (hype >= 30) return "Good energy";
  return "Chat is quiet";
}

function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Scoped additions on top of the shared overlay styles in globals.css.
const demoStyles = `
.demo-transparent { background: transparent; }
.demo-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
.demo-grid .hype-widget { grid-row: span 2; }
.topic-list { padding: 0.65rem 1.15rem 0.9rem; min-height: 9rem; }
.topic-row {
  display: grid; grid-template-columns: minmax(4.5rem, 0.4fr) minmax(0, 1fr) auto;
  gap: 0.65rem; align-items: center; padding: 0.42rem 0;
  border-bottom: 1px solid rgb(255 255 255 / 5%); font-size: 0.78rem;
}
.topic-row:last-child { border-bottom: 0; }
.topic-name { color: #d7dcd8; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.topic-bar { height: 0.35rem; border-radius: 999px; background: rgb(255 255 255 / 7%); overflow: hidden; }
.topic-bar-fill { display: block; height: 100%; border-radius: 999px; background: #53fc18; transition: width 300ms ease; }
.trend-badge {
  display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.18rem 0.5rem;
  border: 1px solid rgb(255 255 255 / 8%); border-radius: 999px;
  color: #8d958f; font-size: 0.64rem; font-weight: 650; white-space: nowrap;
}
.trend-badge.rising { border-color: rgb(83 252 24 / 25%); color: #a7ff88; background: rgb(83 252 24 / 7%); }
.trend-badge.falling { border-color: rgb(248 147 93 / 25%); color: #f8ba66; background: rgb(248 147 93 / 6%); }
.spam-flag { display: inline-flex; align-items: center; gap: 0.35rem; color: #f8ba66 !important; }
.demo-messages { min-height: 8rem; }
.toast-stack {
  position: fixed; right: clamp(1rem, 3vw, 2.5rem); bottom: clamp(1rem, 3vw, 2.5rem);
  display: flex; flex-direction: column; gap: 0.6rem; max-width: 24rem; z-index: 10;
}
.toast {
  display: flex; align-items: center; gap: 0.55rem; padding: 0.75rem 1rem;
  border: 1px solid rgb(83 252 24 / 22%); border-radius: 0.9rem;
  background: rgb(16 20 17 / 94%); color: #e9f5e6; font-size: 0.8rem; font-weight: 550;
  box-shadow: 0 18px 50px rgb(0 0 0 / 45%);
  animation: toast-in 260ms ease;
}
.toast svg { flex-shrink: 0; color: #53fc18; }
.toast-impact { border-color: rgb(83 252 24 / 45%); }
.toast-ready { border-color: rgb(255 255 255 / 14%); }
@keyframes toast-in { from { opacity: 0; transform: translateY(0.6rem); } }
@media (max-width: 760px) { .demo-grid { grid-template-columns: 1fr; } .demo-grid .hype-widget { grid-row: auto; } }
`;
