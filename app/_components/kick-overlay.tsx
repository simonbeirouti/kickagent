"use client";

import {
  ActivityIcon,
  Clock3Icon,
  GripVerticalIcon,
  LogOutIcon,
  MessageCircleIcon,
  RadioIcon,
  SparklesIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { DashboardContentManager } from "@/app/_components/dashboard-content-manager";
import {
  publishDemoOverlayState,
  readDemoOverlayState,
  subscribeToDemoOverlayState,
} from "@/lib/demo-overlay-store";
import {
  OVERLAY_COLUMNS,
  OVERLAY_ROWS,
  WIDGET_DEFAULTS,
  type OverlayLayout,
  type WidgetKind,
  type WidgetPlacement,
} from "@/lib/overlay-layout";
import type { OverlayState } from "@/lib/overlay-state";

interface DragPayload {
  readonly id?: string;
  readonly kind: WidgetKind;
  readonly offsetX: number;
  readonly offsetY: number;
}

const WIDGET_LABELS: Readonly<Record<WidgetKind, string>> = {
  chat: "Latest chat",
  hype: "Hype score",
  suggestion: "Next talking point",
};

export function KickOverlay({
  accessToken,
  demoMode = false,
  publicMode = false,
}: {
  readonly accessToken?: string;
  readonly demoMode?: boolean;
  readonly publicMode?: boolean;
}) {
  const [state, setState] = useState<OverlayState>();
  const [draftLayout, setDraftLayout] = useState<OverlayLayout>();
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [error, setError] = useState<string>();
  const [disconnecting, setDisconnecting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const refresh = useCallback(
    async (syncKick = false) => {
      try {
        const search = new URLSearchParams();
        if (accessToken) search.set("token", accessToken);
        else if (publicMode) search.set("public", "overlay");
        if (demoMode) search.set("demo", "1");
        if (syncKick && !demoMode) search.set("sync", "kick");
        const response = await fetch(`/api/overlay/state?${search}`, { cache: "no-store" });
        if (response.status === 401) {
          setAuthenticated(false);
          setState(undefined);
          return;
        }
        if (!response.ok) throw new Error("Overlay update failed.");
        const received = (await response.json()) as OverlayState;
        const next = demoMode ? readDemoOverlayState(received) : received;
        setState(next);
        if (!publicMode) setDraftLayout((current) => current ?? next.layout);
        setAuthenticated(true);
        setError(undefined);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Overlay update failed.");
      }
    },
    [accessToken, demoMode, publicMode],
  );

  useEffect(() => {
    const queryError = new URLSearchParams(window.location.search).get("error");
    if (queryError && !publicMode) setError(formatConnectionError(queryError));
    void refresh(true);
    let refreshCount = 0;
    const timer = window.setInterval(() => {
      refreshCount += 1;
      void refresh(refreshCount % 5 === 0);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [publicMode, refresh]);

  useEffect(() => {
    if (!demoMode) return;
    return subscribeToDemoOverlayState((next) => {
      setState(next);
      setDraftLayout(next.layout);
      setAuthenticated(true);
    });
  }, [demoMode]);

  const saveLayout = async (layout: OverlayLayout) => {
    setDraftLayout(layout);
    setSaveState("saving");
    if (demoMode) {
      if (state) setState(publishDemoOverlayState({ ...state, layout }));
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1_500);
      return;
    }
    try {
      const response = await fetch("/api/overlay/layout", {
        body: JSON.stringify(layout),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) throw new Error("Could not save the overlay layout.");
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1_500);
    } catch (cause) {
      setSaveState("idle");
      setError(cause instanceof Error ? cause.message : "Could not save the overlay layout.");
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/auth/kick/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Disconnect failed.");
      setState(undefined);
      setAuthenticated(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Disconnect failed.");
    } finally {
      setDisconnecting(false);
    }
  };

  if (authenticated === undefined) return <LoadingScreen />;
  if (!authenticated || !state) {
    return publicMode ? <InvalidOverlayScreen /> : <ConnectScreen error={error} />;
  }

  if (publicMode) {
    return (
      <main className="public-overlay-shell">
        <OverlayCanvas
          layout={state.layout}
          publicMode
          state={state}
        />
      </main>
    );
  }

  const layout = draftLayout ?? state.layout;
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="channel-identity">
          {state.channel.profilePicture ? (
            <img alt="" className="channel-avatar" src={state.channel.profilePicture} />
          ) : (
            <span className="channel-avatar channel-avatar-fallback">K</span>
          )}
          <div>
            <p className="eyebrow">Overlay studio</p>
            <h1>{state.channel.displayName}</h1>
          </div>
        </div>
        <div className="header-actions">
          <StatusPill live={state.live} />
          {demoMode ? <span className="demo-pill">No auth · Demo data</span> : null}
          {!demoMode ? (
            <button
              aria-label="Disconnect Kick"
              className="icon-button"
              disabled={disconnecting}
              onClick={() => void disconnect()}
              type="button"
            >
              <LogOutIcon size={17} />
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {demoMode ? (
        <DashboardContentManager
          onChange={(next) => setState(publishDemoOverlayState(next))}
          publicEditor={(
            <div className="editor-layout manager-public-editor">
              <WidgetLibrary layout={layout} saveLayout={saveLayout} saveState={saveState} />
              <section className="canvas-panel">
                <div className="canvas-heading">
                  <div>
                    <p className="eyebrow">Edit widgets directly</p>
                    <h2>1920 × 1080</h2>
                  </div>
                  <span>Drag to reposition</span>
                </div>
                <OverlayCanvas
                  layout={layout}
                  onLayoutChange={(next) => void saveLayout(next)}
                  onStateChange={(next) => setState(publishDemoOverlayState(next))}
                  state={state}
                />
              </section>
            </div>
          )}
          state={state}
        />
      ) : (
        <div className="editor-layout">
          <WidgetLibrary layout={layout} saveLayout={saveLayout} saveState={saveState} />
          <section className="canvas-panel">
            <div className="canvas-heading"><h2>1920 × 1080</h2><span>Drag to reposition</span></div>
            <OverlayCanvas layout={layout} onLayoutChange={(next) => void saveLayout(next)} state={state} />
          </section>
        </div>
      )}
    </main>
  );
}

function WidgetLibrary({
  layout,
  saveLayout,
  saveState,
}: {
  readonly layout: OverlayLayout;
  readonly saveLayout: (layout: OverlayLayout) => Promise<void>;
  readonly saveState: "idle" | "saving" | "saved";
}) {
  return (
    <aside className="widget-library">
      <div>
        <p className="eyebrow">Widgets</p>
        <h2>Build your screen</h2>
        <p className="library-copy">Add a widget, then edit it directly on the canvas.</p>
      </div>
      <div className="library-list">
        {(["suggestion", "chat", "hype"] as const).map((kind) => {
          const added = layout.some((item) => item.kind === kind);
          return (
            <button
              className="library-widget"
              disabled={added}
              draggable={!added}
              key={kind}
              onClick={() => {
                if (!added) void saveLayout([...layout, WIDGET_DEFAULTS[kind]]);
              }}
              onDragStart={(event) => startLibraryDrag(event, kind)}
              type="button"
            >
              <WidgetKindIcon kind={kind} />
              <span>{WIDGET_LABELS[kind]}</span>
              <GripVerticalIcon className="library-grip" size={16} />
            </button>
          );
        })}
      </div>
      <p className="save-indicator" aria-live="polite">
        {saveState === "saving" ? "Saving layout…" : saveState === "saved" ? "Layout saved" : "24 × 14 snap grid"}
      </p>
    </aside>
  );
}

function OverlayCanvas({
  layout,
  onLayoutChange,
  onStateChange,
  publicMode = false,
  state,
}: {
  readonly layout: OverlayLayout;
  readonly onLayoutChange?: (layout: OverlayLayout) => void;
  readonly onStateChange?: (state: OverlayState) => void;
  readonly publicMode?: boolean;
  readonly state: OverlayState;
}) {
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!onLayoutChange) return;
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload) return;
    const template = payload.id
      ? layout.find((item) => item.id === payload.id)
      : WIDGET_DEFAULTS[payload.kind];
    if (!template) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const column = Math.round(((event.clientX - bounds.left) / bounds.width) * OVERLAY_COLUMNS);
    const row = Math.round(((event.clientY - bounds.top) / bounds.height) * OVERLAY_ROWS);
    const moved = {
      ...template,
      x: clamp(column - payload.offsetX, 0, OVERLAY_COLUMNS - template.width),
      y: clamp(row - payload.offsetY, 0, OVERLAY_ROWS - template.height),
    };
    const next = payload.id
      ? layout.map((item) => (item.id === payload.id ? moved : item))
      : [...layout.filter((item) => item.kind !== payload.kind), moved];
    onLayoutChange(next);
  };

  return (
    <div
      className={publicMode ? "overlay-canvas public" : "overlay-canvas editor"}
      onDragOver={onLayoutChange ? (event) => event.preventDefault() : undefined}
      onDrop={onLayoutChange ? onDrop : undefined}
    >
      {layout.map((placement) => (
        <article
          className={`canvas-widget ${publicMode ? "" : "editable"}`}
          draggable={!publicMode}
          key={placement.id}
          onDragStart={
            publicMode ? undefined : (event) => startPlacedDrag(event, placement)
          }
          style={placementStyle(placement)}
        >
          {!publicMode ? (
            <button
              aria-label={`Remove ${WIDGET_LABELS[placement.kind]}`}
              className="remove-widget"
              onClick={() => onLayoutChange?.(layout.filter((item) => item.id !== placement.id))}
              type="button"
            >
              <Trash2Icon size={13} />
            </button>
          ) : null}
          <WidgetContent
            editable={Boolean(onStateChange)}
            kind={placement.kind}
            onStateChange={onStateChange}
            state={state}
          />
        </article>
      ))}
      {!publicMode && layout.length === 0 ? (
        <div className="empty-canvas">
          <SparklesIcon size={22} />
          <span>Drag a widget here</span>
        </div>
      ) : null}
    </div>
  );
}

function WidgetContent({
  editable,
  kind,
  onStateChange,
  state,
}: {
  readonly editable: boolean;
  readonly kind: WidgetKind;
  readonly onStateChange?: (state: OverlayState) => void;
  readonly state: OverlayState;
}) {
  const labels = state.surfaceContent?.widgetLabels;
  const updateLabel = (
    key: keyof NonNullable<OverlayState["surfaceContent"]>["widgetLabels"],
    value: string,
  ) => {
    if (!state.surfaceContent) return;
    onStateChange?.({
      ...state,
      surfaceContent: {
        ...state.surfaceContent,
        widgetLabels: { ...state.surfaceContent.widgetLabels, [key]: value },
      },
    });
  };

  if (kind === "suggestion") {
    return (
      <div className="canvas-widget-inner suggestion-canvas-widget">
        <WidgetHeader
          icon={<SparklesIcon size={17} />}
          label={editable ? (
            <EditableWidgetText
              ariaLabel="Public suggestion widget title"
              onChange={(value) => updateLabel("publicSuggestion", value)}
              value={labels?.publicSuggestion ?? ""}
            />
          ) : labels?.publicSuggestion ?? "Next talking point"}
        >
          <Freshness generatedAt={state.suggestion?.generatedAt} stale={state.suggestion?.stale} />
        </WidgetHeader>
        <div className="suggestion-content">
          {editable ? (
            <textarea
              aria-label="Public talking point"
              className="public-widget-prompt-input"
              onChange={(event) => onStateChange?.({
                ...state,
                suggestion: state.suggestion
                  ? { ...state.suggestion, text: event.target.value }
                  : null,
              })}
              value={suggestionText(state)}
            />
          ) : <p>{suggestionText(state)}</p>}
        </div>
        <footer className="widget-footer">
          {editable ? (
            <>
              <EditableWidgetText
                ariaLabel="Public stream title"
                onChange={(value) => onStateChange?.({ ...state, channel: { ...state.channel, streamTitle: value } })}
                value={state.channel.streamTitle ?? ""}
              />
              <EditableWidgetText
                ariaLabel="Public category"
                onChange={(value) => onStateChange?.({ ...state, channel: { ...state.channel, category: value } })}
                value={state.channel.category ?? ""}
              />
            </>
          ) : (
            <><span>{state.channel.streamTitle || "No stream title"}</span><span>{state.channel.category || "No category"}</span></>
          )}
        </footer>
      </div>
    );
  }
  if (kind === "chat") {
    return (
      <div className="canvas-widget-inner chat-canvas-widget">
        <WidgetHeader
          icon={<MessageCircleIcon size={17} />}
          label={editable ? (
            <EditableWidgetText
              ariaLabel="Public chat widget title"
              onChange={(value) => updateLabel("publicChat", value)}
              value={labels?.publicChat ?? ""}
            />
          ) : labels?.publicChat ?? "Latest chat"}
        >
          <span className="count-badge">{state.messages.length}/5</span>
        </WidgetHeader>
        <div className="message-list">
          {state.messages.length === 0 ? (
            <div className="empty-messages"><RadioIcon size={20} /></div>
          ) : state.messages.map((message, index) => (
            <div className="chat-message" key={message.id}>
              {editable ? (
                <>
                  <EditableWidgetText
                    ariaLabel={`Public chat username ${index + 1}`}
                    className="chat-user"
                    onChange={(value) => onStateChange?.({
                      ...state,
                      messages: state.messages.map((item, itemIndex) => itemIndex === index ? { ...item, username: value } : item),
                    })}
                    value={message.username}
                  />
                  <EditableWidgetText
                    ariaLabel={`Public chat message ${index + 1}`}
                    className="chat-copy"
                    onChange={(value) => onStateChange?.({
                      ...state,
                      messages: state.messages.map((item, itemIndex) => itemIndex === index ? { ...item, content: value } : item),
                    })}
                    value={message.content}
                  />
                </>
              ) : (
                <><span className="chat-user">{message.username}</span><span className="chat-copy">{message.content}</span></>
              )}
              <time>{relativeTime(message.createdAt)}</time>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="canvas-widget-inner hype-canvas-widget">
      <WidgetHeader
        icon={<ActivityIcon size={17} />}
        label={editable ? (
          <EditableWidgetText
            ariaLabel="Public hype widget title"
            onChange={(value) => updateLabel("publicHype", value)}
            value={labels?.publicHype ?? ""}
          />
        ) : labels?.publicHype ?? "Hype score"}
      >
        <span className="preview-badge">
          {!state.ingestionEnabled ? "Preview" : state.hypeReady ? "Live" : "Calibrating"}
        </span>
      </WidgetHeader>
      <div className="hype-content">
        <div
          aria-label={`Hype score ${state.hypeScore} out of 100`}
          className="hype-ring"
          style={{ "--hype": `${state.hypeScore * 3.6}deg` } as CSSProperties}
        >
          {editable ? (
            <input
              aria-label="Public hype score"
              className="hype-score-input"
              max="100"
              min="0"
              onChange={(event) => onStateChange?.({ ...state, hypeScore: Number(event.target.value) })}
              type="number"
              value={state.hypeScore}
            />
          ) : <strong>{state.hypeScore}</strong>}
          <span>/ 100</span>
        </div>
        <div className="hype-copy"><ZapIcon size={18} /><span>{hypeLabel(state)}</span></div>
      </div>
    </div>
  );
}

function WidgetHeader({ children, icon, label }: { readonly children: ReactNode; readonly icon: ReactNode; readonly label: ReactNode }) {
  return <header className="widget-header"><span className="widget-title">{icon}{label}</span>{children}</header>;
}

function EditableWidgetText({
  ariaLabel,
  className,
  onChange,
  value,
}: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className={`editable-widget-text ${className ?? ""}`}
      onChange={(event) => onChange(event.target.value)}
      onDragStart={(event) => event.stopPropagation()}
      value={value}
    />
  );
}

function WidgetKindIcon({ kind }: { readonly kind: WidgetKind }) {
  if (kind === "chat") return <MessageCircleIcon size={17} />;
  if (kind === "hype") return <ActivityIcon size={17} />;
  return <SparklesIcon size={17} />;
}

function StatusPill({ live }: { readonly live: boolean }) {
  return <span className={live ? "status-pill live" : "status-pill offline"}><span className="status-dot" />{live ? "Live" : "Offline"}</span>;
}

function Freshness({ generatedAt, stale }: { readonly generatedAt?: string; readonly stale?: boolean }) {
  return <span className={stale ? "freshness stale" : "freshness"}><Clock3Icon size={13} />{generatedAt ? (stale ? "Delayed" : relativeTime(generatedAt)) : "Waiting"}</span>;
}

function startLibraryDrag(event: DragEvent<HTMLButtonElement>, kind: WidgetKind) {
  const template = WIDGET_DEFAULTS[kind];
  writeDragPayload(event, { kind, offsetX: Math.floor(template.width / 2), offsetY: Math.floor(template.height / 2) });
}

function startPlacedDrag(event: DragEvent<HTMLElement>, placement: WidgetPlacement) {
  const bounds = event.currentTarget.getBoundingClientRect();
  writeDragPayload(event, {
    id: placement.id,
    kind: placement.kind,
    offsetX: Math.round((event.nativeEvent.offsetX / bounds.width) * placement.width),
    offsetY: Math.round((event.nativeEvent.offsetY / bounds.height) * placement.height),
  });
}

function writeDragPayload(event: DragEvent<HTMLElement>, payload: DragPayload) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-kick-widget", JSON.stringify(payload));
}

function readDragPayload(event: DragEvent<HTMLElement>): DragPayload | undefined {
  try {
    return JSON.parse(event.dataTransfer.getData("application/x-kick-widget")) as DragPayload;
  } catch {
    return undefined;
  }
}

function placementStyle(placement: WidgetPlacement): CSSProperties {
  return {
    height: `${(placement.height / OVERLAY_ROWS) * 100}%`,
    left: `${(placement.x / OVERLAY_COLUMNS) * 100}%`,
    top: `${(placement.y / OVERLAY_ROWS) * 100}%`,
    width: `${(placement.width / OVERLAY_COLUMNS) * 100}%`,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hypeLabel(state: OverlayState): string {
  if (!state.ingestionEnabled) return "Sample data";
  if (!state.hypeReady) return "Learning this chat's baseline…";
  if (state.hypeTrend === "rising") return "Heating up";
  if (state.hypeTrend === "falling") return "Cooling off";
  return "Holding steady";
}

function suggestionText(state: OverlayState): string {
  if (state.suggestion?.text) return state.suggestion.text;
  return "";
}

function ConnectScreen({ error }: { readonly error?: string }) {
  return (
    <main className="connect-screen"><div className="connect-card"><div className="kick-mark">K</div><p className="eyebrow">Kick streamer companion</p><h1>Stay present. We’ll watch the room.</h1><p className="connect-copy">Get a fresh talking point every 30 seconds, keep the latest chat close, and never lose the energy of your stream.</p>{error ? <div className="connect-error">{error}</div> : null}<a className="connect-button" href="/api/auth/kick/start">Connect Kick<span aria-hidden>→</span></a><p className="privacy-note">Private to you. This companion never posts in your chat.</p></div></main>
  );
}

function InvalidOverlayScreen() {
  return <main className="connect-screen"><div className="connect-card invalid-overlay-card"><div className="kick-mark">K</div><p className="eyebrow">Kick streamer companion</p><h1>Overlay unavailable.</h1><p className="connect-copy">Connect Kick to publish widgets here.</p></div></main>;
}

function LoadingScreen() {
  return <main className="connect-screen"><div className="loading-pulse" /></main>;
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}

function formatConnectionError(code: string): string {
  const messages: Record<string, string> = {
    account_not_allowed: "This Kick account is not allowed to use this companion.",
    kick_connection_failed: "Kick could not be connected. Check the app and webhook settings.",
    oauth_state_invalid: "The Kick sign-in expired. Please try again.",
    oauth_state_missing: "The Kick sign-in could not be verified. Please try again.",
  };
  return messages[code] ?? "Kick could not be connected.";
}
