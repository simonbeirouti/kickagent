"use client";

import {
  MessageCircleIcon,
  RadioIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createHudEngine, type HudEngine, type HudSnapshot } from "@/lib/glasses-hud-engine";
import { useDemoOverlayState } from "@/lib/demo-overlay-store";
import type { OverlayState } from "@/lib/overlay-state";

type PhonePanel = "brief" | "chat" | "summary";

const HUD_PANEL_KEYS = ["topbar", "prediction", "active", "predictions", "reticle", "toast"] as const;
type HudPanelKey = (typeof HUD_PANEL_KEYS)[number];

const HUD_LAYOUT_STORAGE_KEY = "glasses-hud-layout-v1";

export function GlassesSurface() {
  // The simulation engine uses Math.random()/Date.now(), so it must never run
  // during SSR — creating and ticking it only inside an effect keeps the
  // server-rendered markup and the first client render identical.
  const engineRef = useRef<HudEngine | null>(null);
  const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const drag = useDraggableHudPanels();
  const predictionCardRef = useRef<HTMLElement | null>(null);
  const activeCardRef = useRef<HTMLElement | null>(null);
  const activeAmountRef = useRef<HTMLDivElement | null>(null);
  const previousQuestion = useRef<string | null>(null);
  const previousBetKey = useRef<string | null>(null);

  useEffect(() => {
    const engine = createHudEngine(3);
    engineRef.current = engine;
    setSnapshot(engine.tick(0));

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      setSnapshot(engine.tick((now - last) / 1_000));
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "h") { setHintVisible((visible) => !visible); return; }
      if (key === "l") { drag.toggleEditMode(); return; }
      if (key === "r" && drag.editMode) { drag.resetLayout(); return; }
      if (drag.editMode) return;
      if (key === "n") engineRef.current?.newMarket();
      if (key === "b") engineRef.current?.newBet();
      if (key === "t") engineRef.current?.showToast();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag]);

  useEffect(() => {
    const question = snapshot?.featured?.question ?? null;
    if (question && question !== previousQuestion.current && predictionCardRef.current) {
      flashElement(predictionCardRef.current, "glasses-hud-pop");
      flashElement(predictionCardRef.current, "glasses-hud-glow");
    }
    previousQuestion.current = question;
  }, [snapshot?.featured?.question]);

  useEffect(() => {
    const betKey = snapshot?.bet ? `${snapshot.bet.text}|${snapshot.bet.status}` : null;
    if (betKey && betKey !== previousBetKey.current) {
      if (activeCardRef.current) flashElement(activeCardRef.current, "glasses-hud-pop");
      if (activeAmountRef.current) flashElement(activeAmountRef.current, "glasses-hud-bump");
    }
    previousBetKey.current = betKey;
  }, [snapshot?.bet?.status, snapshot?.bet?.text]);

  const toast = snapshot?.toast ?? { copy: "", icon: "⚡", kind: "" as const, title: "", visible: false };

  if (!snapshot) {
    return (
      <main className="glasses-hud">
        <div className="glasses-hud-scanlines" aria-hidden />
        <div className="glasses-hud-vignette" aria-hidden />
      </main>
    );
  }

  return (
    <main
      className="glasses-hud"
      data-hud-edit={drag.editMode || undefined}
      onDoubleClick={() => {
        if (drag.editMode) return;
        if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
        else void document.exitFullscreen?.();
      }}
    >
      <div className="glasses-hud-scanlines" aria-hidden />
      <div className="glasses-hud-vignette" aria-hidden />

      <header
        className="glasses-hud-panel glasses-hud-topbar"
        data-hud-key="topbar"
        onPointerDown={drag.startDrag("topbar")}
        ref={drag.ref("topbar")}
        style={drag.styleFor("topbar")}
      >
        <span className="glasses-hud-live"><i /> LIVE HUD</span>
        <div className="glasses-hud-top-meta">
          <span>{snapshot.topbar.clock}</span>
          <span className="glasses-hud-sep" />
          <span>👁 <b>{snapshot.topbar.viewers.toLocaleString("en-US")}</b></span>
          <span className="glasses-hud-sep" />
          <span className={snapshot.topbar.hypeUp ? "glasses-hud-hype" : "glasses-hud-hype down"}>
            {snapshot.topbar.hypeUp ? "▲" : "▼"} {snapshot.topbar.hype} HYPE
          </span>
          <span className="glasses-hud-sep" />
          <span>AI AGENT ONLINE</span>
          <div className="glasses-hud-battery"><div className="glasses-hud-battery-fill" style={{ width: `${snapshot.topbar.battery}%` }} /></div>
        </div>
      </header>

      {snapshot.featured ? (
        <section
          className="glasses-hud-panel glasses-hud-prediction"
          data-hud-key="prediction"
          onPointerDown={drag.startDrag("prediction")}
          ref={(element) => { predictionCardRef.current = element; drag.ref("prediction")(element); }}
          style={drag.styleFor("prediction")}
        >
          <div className="glasses-hud-card-head">
            <span className="glasses-hud-card-head-left">
              <span className="glasses-hud-check">✓</span>
              <span className="glasses-hud-label">New prediction</span>
            </span>
            <span className="glasses-hud-ago">{snapshot.featured.ago}</span>
          </div>
          <div className="glasses-hud-question">{snapshot.featured.question}</div>
          <div className="glasses-hud-split">
            <div className="glasses-hud-choice yes">
              <div className="glasses-hud-choice-title">YES&nbsp; <span>{snapshot.featured.yesPct}%</span></div>
              <div className="glasses-hud-money">{snapshot.featured.yesPool}</div>
            </div>
            <div className="glasses-hud-choice no">
              <div className="glasses-hud-choice-title">NO&nbsp; <span>{snapshot.featured.noPct}%</span></div>
              <div className="glasses-hud-money">{snapshot.featured.noPool}</div>
            </div>
          </div>
          <div className={snapshot.featured.urgent ? "glasses-hud-ends urgent" : "glasses-hud-ends"}>{snapshot.featured.ends}</div>
        </section>
      ) : null}

      {snapshot.bet ? (
        <section
          className={`glasses-hud-panel glasses-hud-active ${snapshot.bet.status}`}
          data-hud-key="active"
          onPointerDown={drag.startDrag("active")}
          ref={(element) => { activeCardRef.current = element; drag.ref("active")(element); }}
          style={drag.styleFor("active")}
        >
          <div className="glasses-hud-card-head">
            <span className="glasses-hud-card-head-left">
              <span className="glasses-hud-bet-icon">{snapshot.bet.icon}</span>
              <span className="glasses-hud-label gold">Bet active</span>
            </span>
          </div>
          <div className="glasses-hud-active-main">
            <div className="glasses-hud-active-text">{snapshot.bet.text}</div>
            <div className="glasses-hud-amount" ref={activeAmountRef}>{snapshot.bet.amount}</div>
          </div>
          <div className={`glasses-hud-status ${snapshot.bet.status}`}><i />{snapshot.bet.statusText}</div>
        </section>
      ) : null}

      <section
        className="glasses-hud-panel glasses-hud-top-predictions"
        data-hud-key="predictions"
        onPointerDown={drag.startDrag("predictions")}
        ref={drag.ref("predictions")}
        style={drag.styleFor("predictions")}
      >
        <div className="glasses-hud-title">TOP PREDICTIONS</div>
        {snapshot.topRows.map((row) => (
          <div className="glasses-hud-pred-row" key={row.id}>
            <div className="glasses-hud-pred-name"><span className="glasses-hud-icon">{row.icon}</span>{row.name}</div>
            <div className="glasses-hud-bar-wrap">
              <div className="glasses-hud-bar"><div className={row.yesPct < 50 ? "glasses-hud-fill red" : "glasses-hud-fill"} style={{ width: `${row.yesPct}%` }} /></div>
              <div className="glasses-hud-pct">{row.yesPct}%</div>
            </div>
            <div className="glasses-hud-small-no">
              <div className="glasses-hud-mini"><span style={{ width: `${row.noPct}%` }} /></div>
              <b>NO</b>
            </div>
          </div>
        ))}
        <button className="glasses-hud-all-btn" type="button">View All {snapshot.totalMarkets} Predictions →</button>
      </section>

      <div
        className="glasses-hud-reticle"
        data-hud-key="reticle"
        onPointerDown={drag.startDrag("reticle")}
        ref={drag.ref("reticle")}
        style={drag.styleFor("reticle")}
      ><span /></div>

      <aside
        className={`glasses-hud-panel glasses-hud-toast ${toast.kind} ${toast.visible ? "show" : ""}`}
        data-hud-key="toast"
        onPointerDown={drag.startDrag("toast")}
        ref={drag.ref("toast")}
        style={drag.styleFor("toast")}
      >
        <div className="glasses-hud-toast-icon">{toast.icon}</div>
        {/* Toast copy is built from hardcoded demo templates (lib/glasses-hud-engine.ts), never user input. */}
        <div>
          <div className="glasses-hud-toast-title">{toast.title}</div>
          <div className="glasses-hud-toast-copy" dangerouslySetInnerHTML={{ __html: toast.copy }} />
        </div>
      </aside>

      {drag.editMode ? <div className="glasses-hud-layout-badge">Layout edit — drag panels • L to exit • R to reset</div> : null}
      {hintVisible ? (
        <div className="glasses-hud-hint">H hide chrome • L move panels • N new prediction • B new bet • T toast • Double-click fullscreen</div>
      ) : null}
    </main>
  );
}

interface DraggableHudPanels {
  readonly editMode: boolean;
  readonly ref: (key: HudPanelKey) => (element: HTMLElement | null) => void;
  readonly resetLayout: () => void;
  readonly startDrag: (key: HudPanelKey) => (event: ReactPointerEvent<HTMLElement>) => void;
  readonly styleFor: (key: HudPanelKey) => CSSProperties | undefined;
  readonly toggleEditMode: () => void;
}

function useDraggableHudPanels(): DraggableHudPanels {
  const [editMode, setEditMode] = useState(false);
  const [positions, setPositions] = useState<Partial<Record<HudPanelKey, { left: number; top: number }>>>({});
  const elements = useRef<Partial<Record<HudPanelKey, HTMLElement>>>({});
  const dragging = useRef<{ key: HudPanelKey; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HUD_LAYOUT_STORAGE_KEY);
      if (stored) setPositions(JSON.parse(stored));
    } catch {
      // Ignore malformed saved layout and fall back to the default arrangement.
    }
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = dragging.current;
      const el = current ? elements.current[current.key] : undefined;
      if (!current || !el) return;
      const x = clampNumber(event.clientX - current.offsetX, -el.offsetWidth * 0.6, window.innerWidth - el.offsetWidth * 0.4);
      const y = clampNumber(event.clientY - current.offsetY, -el.offsetHeight * 0.6, window.innerHeight - el.offsetHeight * 0.4);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const onUp = () => {
      const current = dragging.current;
      const el = current ? elements.current[current.key] : undefined;
      if (current && el) {
        el.dataset.dragging = "false";
        const rect = el.getBoundingClientRect();
        setPositions((prev) => {
          const next = { ...prev, [current.key]: { left: rect.left, top: rect.top } };
          window.localStorage.setItem(HUD_LAYOUT_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
      dragging.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return {
    editMode,
    ref: (key) => (element) => {
      if (element) elements.current[key] = element;
      else delete elements.current[key];
    },
    resetLayout: () => {
      window.localStorage.removeItem(HUD_LAYOUT_STORAGE_KEY);
      setPositions({});
    },
    startDrag: (key) => (event) => {
      if (!editMode) return;
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.transform = "none";
      el.dataset.dragging = "true";
      dragging.current = { key, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      el.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    styleFor: (key) => {
      const pos = positions[key];
      return pos ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto", transform: "none" } : undefined;
    },
    toggleEditMode: () => setEditMode((value) => !value),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function flashElement(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

export function StreamerPhoneSurface({ initialState }: { readonly initialState: OverlayState }) {
  const state = useDemoOverlayState(initialState);
  const [panel, setPanel] = useState<PhonePanel>("brief");
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
