"use client";

import {
  ActivityIcon,
  BellRingIcon,
  CoinsIcon,
  CrownIcon,
  ExternalLinkIcon,
  FlameIcon,
  GaugeIcon,
  GlassesIcon,
  GripVerticalIcon,
  HandshakeIcon,
  LogOutIcon,
  MessageCircleIcon,
  MonitorUpIcon,
  SkullIcon,
  SmartphoneIcon,
  SmilePlusIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  ActionBetWidget,
  AlertsWidget,
  BattleWidget,
  BossWidget,
  EmoteWallWidget,
  GoalsWidget,
  JarWidget,
  LeaderboardWidget,
  PulseWidget,
  PredictionWidget,
  WidgetHeader,
} from "@/app/_components/overlay-widgets";
import { useLiveOverlayState } from "@/lib/live-overlay-store";
import {
  MIN_WIDGET_HEIGHT,
  MIN_WIDGET_WIDTH,
  OVERLAY_COLUMNS,
  OVERLAY_ROWS,
  WIDGET_DEFAULTS,
  type ManagedScreen,
  type OverlayLayout,
  type WidgetKind,
  type WidgetPlacement,
} from "@/lib/overlay-layout";
import { usePersistedScreenLayouts } from "@/lib/overlay-layout-store";
import type { OverlayState } from "@/lib/overlay-state";

interface DragPayload {
  readonly id?: string;
  readonly kind: WidgetKind;
  readonly offsetX: number;
  readonly offsetY: number;
}

const MANAGED_SCREENS: readonly {
  readonly dimensions: string;
  readonly href: string;
  readonly icon: typeof GlassesIcon;
  readonly id: ManagedScreen;
  readonly label: string;
}[] = [
  { dimensions: "16:9 view", href: "/glasses", icon: GlassesIcon, id: "glasses", label: "Glasses" },
  { dimensions: "9:16 view", href: "/streamer", icon: SmartphoneIcon, id: "phone", label: "Streamer phone" },
  { dimensions: "1920 × 1080", href: "/public/overlay", icon: MonitorUpIcon, id: "public", label: "Public overlay" },
];

const WIDGET_LABELS: Readonly<Record<WidgetKind, string>> = {
  actionBet: "Action bet",
  alerts: "Alerts",
  battle: "Hype battle",
  boss: "Stream boss",
  chat: "Latest chat",
  emotes: "Emote wall",
  goals: "Stream goals",
  hype: "Agent energy",
  jar: "Support jar",
  leaderboard: "Top supporters",
  prediction: "Prediction",
  pulse: "Chat pulse",
  suggestion: "Live brief",
};

const WIDGET_GROUPS: readonly {
  readonly kinds: readonly WidgetKind[];
  readonly label: string;
}[] = [
  { kinds: ["suggestion", "chat", "hype"], label: "Agent" },
  { kinds: ["prediction", "actionBet"], label: "Interactive" },
  { kinds: ["goals", "leaderboard", "jar", "alerts"], label: "Community" },
  { kinds: ["battle", "boss", "emotes", "pulse"], label: "Hype & fun" },
];

export function KickOverlay({
  accessToken,
  liveScreen,
  publicMode = false,
}: {
  readonly accessToken?: string;
  readonly liveScreen?: Exclude<ManagedScreen, "phone">;
  readonly publicMode?: boolean;
}) {
  const standaloneScreen = liveScreen ?? (publicMode ? "public" : undefined);
  const liveState = useLiveOverlayState({ accessToken, publicMode });
  const persistedLayouts = usePersistedScreenLayouts(
    liveState.state?.channel.slug,
    liveState.state
      ? {
          ...liveState.state.screenLayouts,
          public: liveState.state.screenLayouts.public ?? liveState.state.layout,
        }
      : undefined,
  );
  const [draftLayouts, setDraftLayouts] = useState<Partial<Record<ManagedScreen, OverlayLayout>>>({});
  const [disconnecting, setDisconnecting] = useState(false);
  const [publicOverlayUrl, setPublicOverlayUrl] = useState<string>();
  const [publicUrlError, setPublicUrlError] = useState(false);
  const [saveState, setSaveState] = useState<"error" | "idle" | "saving" | "saved">("idle");
  const [selectedScreen, setSelectedScreen] = useState<ManagedScreen>("public");
  const publicLayout = persistedLayouts.layouts?.public
    ?? liveState.state?.screenLayouts.public
    ?? liveState.state?.layout;
  const publicLayoutKey = publicLayout ? JSON.stringify(publicLayout) : "";

  useEffect(() => {
    if (!liveState.state?.channel.slug || !publicLayoutKey || standaloneScreen) return;
    let cancelled = false;
    setPublicUrlError(false);
    void requestPublicOverlayUrl(JSON.parse(publicLayoutKey) as OverlayLayout)
      .then((url) => {
        if (!cancelled) setPublicOverlayUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setPublicOverlayUrl(undefined);
          setPublicUrlError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [liveState.state?.channel.slug, publicLayoutKey, standaloneScreen]);

  if (liveState.authenticated === undefined) return <LoadingScreen />;
  if (!liveState.authenticated || !liveState.state) {
    return publicMode ? <InvalidOverlayScreen /> : <ConnectScreen error={liveState.error} />;
  }
  const state = liveState.state;

  if (standaloneScreen) {
    const layout = state.screenLayouts[standaloneScreen]
      ?? (standaloneScreen === "public" ? state.layout : []);
    return (
      <main className="public-overlay-shell">
        <OverlayCanvas
          layout={layout}
          publicMode
          state={state}
        />
      </main>
    );
  }

  const selectedScreenDetails = MANAGED_SCREENS.find((screen) => screen.id === selectedScreen)!;
  const activeLayout = draftLayouts[selectedScreen]
    ?? persistedLayouts.layouts?.[selectedScreen]
    ?? state.screenLayouts[selectedScreen]
    ?? (selectedScreen === "public" ? state.layout : []);
  const saveActiveLayout = async (next: OverlayLayout) => {
    setDraftLayouts((current) => ({ ...current, [selectedScreen]: next }));
    persistedLayouts.persistLayout(selectedScreen, next);
    setSaveState("saving");
    try {
      const response = await fetch("/api/overlay/layout", {
        body: JSON.stringify({ layout: next, screen: selectedScreen }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) throw new Error("Could not save the screen layout.");
      await liveState.refresh();
      setDraftLayouts((current) => ({ ...current, [selectedScreen]: undefined }));
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1_500);
    } catch {
      setSaveState("error");
    }
  };
  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/auth/kick/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Disconnect failed.");
      window.location.reload();
    } finally {
      setDisconnecting(false);
    }
  };
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
          <button
            aria-label="Disconnect Kick"
            className="icon-button"
            disabled={disconnecting}
            onClick={() => void disconnect()}
            type="button"
          >
            <LogOutIcon size={17} />
          </button>
        </div>
      </header>

      <div className="editor-layout dashboard-builder">
        <WidgetLibrary layout={activeLayout} saveLayout={saveActiveLayout} saveState={saveState} />
        <section className="canvas-panel">
          <div className="screen-picker-row">
            <div>
              <p className="eyebrow">Screens</p>
              <nav aria-label="Choose a screen" className="screen-picker">
                {MANAGED_SCREENS.map(({ icon: Icon, id, label }) => (
                  <button aria-pressed={selectedScreen === id} key={id} onClick={() => setSelectedScreen(id)} type="button">
                    <Icon size={15} />{label}
                  </button>
                ))}
              </nav>
            </div>
            <a
              aria-disabled={selectedScreen === "public" && !publicOverlayUrl}
              href={selectedScreen === "public" ? publicOverlayUrl : selectedScreenDetails.href}
              rel="noreferrer"
              target="_blank"
            >
              {selectedScreen === "public" && !publicOverlayUrl
                ? publicUrlError ? "Public URL unavailable" : "Preparing public URL…"
                : "Open live screen"}
              <ExternalLinkIcon size={14} />
            </a>
          </div>
          <div className="canvas-heading">
            <div><p className="eyebrow">Selected screen</p><h2>{selectedScreenDetails.label} · {selectedScreenDetails.dimensions}</h2></div>
            <span>Drag widgets onto the screen</span>
          </div>
          <div className={`screen-canvas-stage ${selectedScreen}`}>
            <OverlayCanvas layout={activeLayout} onLayoutChange={(next) => void saveActiveLayout(next)} screen={selectedScreen} state={state} />
          </div>
        </section>
      </div>
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
  readonly saveState: "error" | "idle" | "saving" | "saved";
}) {
  return (
    <aside className="widget-library">
      <div>
        <p className="eyebrow">Widgets</p>
        <h2>Build your screen</h2>
        <p className="library-copy">Choose the live widgets to show, then position them on the canvas.</p>
      </div>
      <div className="library-groups">
        {WIDGET_GROUPS.map((group) => (
          <div className="library-group" key={group.label}>
            <p className="library-group-label">{group.label}</p>
            <div className="library-list">
              {group.kinds.map((kind) => {
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
          </div>
        ))}
      </div>
      <p className="save-indicator" aria-live="polite">
        {saveState === "saving"
          ? "Saving layout…"
          : saveState === "saved"
            ? "Layout saved"
            : saveState === "error"
              ? "Layout could not be saved"
              : "24 × 14 snap grid"}
      </p>
    </aside>
  );
}

function OverlayCanvas({
  layout,
  onLayoutChange,
  publicMode = false,
  screen = "public",
  state,
}: {
  readonly layout: OverlayLayout;
  readonly onLayoutChange?: (layout: OverlayLayout) => void;
  readonly publicMode?: boolean;
  readonly screen?: ManagedScreen;
  readonly state: OverlayState;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  const onResizeMove = (event: ReactPointerEvent<HTMLButtonElement>, placement: WidgetPlacement) => {
    const canvas = canvasRef.current;
    if (resizingId !== placement.id || !canvas || !onLayoutChange) return;
    const bounds = canvas.getBoundingClientRect();
    const width = clamp(
      Math.round(((event.clientX - bounds.left) / bounds.width) * OVERLAY_COLUMNS) - placement.x,
      MIN_WIDGET_WIDTH,
      OVERLAY_COLUMNS - placement.x,
    );
    const height = clamp(
      Math.round(((event.clientY - bounds.top) / bounds.height) * OVERLAY_ROWS) - placement.y,
      MIN_WIDGET_HEIGHT,
      OVERLAY_ROWS - placement.y,
    );
    if (width === placement.width && height === placement.height) return;
    onLayoutChange(
      layout.map((item) => (item.id === placement.id ? { ...item, height, width } : item)),
    );
  };

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
      className={publicMode ? "overlay-canvas public" : `overlay-canvas editor screen-${screen}`}
      onDragOver={onLayoutChange ? (event) => event.preventDefault() : undefined}
      onDrop={onLayoutChange ? onDrop : undefined}
      ref={canvasRef}
    >
      {layout.map((placement) => (
        <article
          className={`canvas-widget widget-${placement.kind} ${publicMode ? "" : "editable"}`}
          draggable={!publicMode && resizingId !== placement.id}
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
          {!publicMode ? (
            <button
              aria-label={`Resize ${WIDGET_LABELS[placement.kind]}`}
              className="resize-widget"
              onPointerCancel={() => setResizingId(null)}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                setResizingId(placement.id);
              }}
              onPointerMove={(event) => onResizeMove(event, placement)}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                setResizingId(null);
              }}
              type="button"
            />
          ) : null}
          <WidgetContent
            kind={placement.kind}
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
  kind,
  state,
}: {
  readonly kind: WidgetKind;
  readonly state: OverlayState;
}) {
  if (kind === "prediction") return <PredictionWidget state={state} />;
  if (kind === "actionBet") return <ActionBetWidget state={state} />;
  if (kind === "goals") return <GoalsWidget state={state} />;
  if (kind === "leaderboard") return <LeaderboardWidget state={state} />;
  if (kind === "battle") return <BattleWidget state={state} />;
  if (kind === "boss") return <BossWidget state={state} />;
  if (kind === "jar") return <JarWidget state={state} />;
  if (kind === "alerts") return <AlertsWidget state={state} />;
  if (kind === "emotes") return <EmoteWallWidget state={state} />;
  if (kind === "pulse") return <PulseWidget state={state} />;
  if (kind === "suggestion") {
    return (
      <div className="canvas-widget-inner suggestion-canvas-widget">
        <div className="suggestion-content">
          <p>{suggestionText(state)}</p>
        </div>
      </div>
    );
  }
  if (kind === "chat") {
    return (
      <div className="canvas-widget-inner chat-canvas-widget">
        <RecentChatCards messages={state.messages} />
      </div>
    );
  }
  return (
    <div className="canvas-widget-inner hype-canvas-widget">
      <WidgetHeader
        icon={<ActivityIcon size={17} />}
        label="Agent energy"
      >
        <span className="count-badge">{state.hypeScore}/100</span>
      </WidgetHeader>
      <div className="hype-content">
        <div
          aria-label={`Hype score ${state.hypeScore} out of 100`}
          className="hype-ring"
          style={{ "--hype": `${state.hypeScore * 3.6}deg` } as CSSProperties}
        >
          <strong>{state.hypeScore}</strong>
          <span>/ 100</span>
        </div>
        <div className="hype-copy"><ZapIcon size={18} /><span>{energyLabel(state.hypeScore)}</span></div>
      </div>
    </div>
  );
}

const WIDGET_ICONS: Readonly<Record<WidgetKind, typeof SparklesIcon>> = {
  actionBet: HandshakeIcon,
  alerts: BellRingIcon,
  battle: FlameIcon,
  boss: SkullIcon,
  chat: MessageCircleIcon,
  emotes: SmilePlusIcon,
  goals: TargetIcon,
  hype: ActivityIcon,
  jar: CoinsIcon,
  leaderboard: CrownIcon,
  prediction: TrophyIcon,
  pulse: GaugeIcon,
  suggestion: SparklesIcon,
};

function WidgetKindIcon({ kind }: { readonly kind: WidgetKind }) {
  const Icon = WIDGET_ICONS[kind];
  return <Icon size={17} />;
}

function StatusPill({ live }: { readonly live: boolean }) {
  return <span className={live ? "status-pill live" : "status-pill offline"}><span className="status-dot" />{live ? "Live" : "Offline"}</span>;
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

async function requestPublicOverlayUrl(layout: OverlayLayout): Promise<string> {
  const response = await fetch("/api/overlay/access", {
    body: JSON.stringify({ layout }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Could not create the public overlay URL.");
  const result = await response.json() as { readonly url?: unknown };
  if (typeof result.url !== "string") throw new Error("Invalid public overlay URL.");
  return result.url;
}

function suggestionText(state: OverlayState): string {
  if (state.suggestion?.text) return state.suggestion.text;
  return "Listening for a useful moment…";
}

function RecentChatCards({
  messages,
}: {
  readonly messages: OverlayState["messages"];
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="message-list">
      {messages.slice(-5).map((message) => (
        <div className="chat-message" key={message.id}>
          <span className="chat-user">{message.username}</span>
          <span className="chat-copy">{message.content}</span>
          <time>{relativeTime(message.createdAt)}</time>
        </div>
      ))}
    </div>
  );
}

function energyLabel(score: number): string {
  if (score >= 80) return "High energy";
  if (score >= 55) return "Building momentum";
  return "Room is warming up";
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}

function ConnectScreen({ error }: { readonly error?: string }) {
  const queryError = typeof window === "undefined"
    ? undefined
    : new URLSearchParams(window.location.search).get("error") ?? undefined;
  return (
    <main className="connect-screen"><div className="connect-card"><div className="kick-mark">K</div><p className="eyebrow">Kick streamer companion</p><h1>Stay present. We’ll watch the room.</h1><p className="connect-copy">Get a fresh talking point after five messages or 30 seconds, keep the latest chat close, and never lose the energy of your stream.</p>{error || queryError ? <div className="connect-error">{error ?? formatConnectionError(queryError!)}</div> : null}<a className="connect-button" href="/api/auth/kick/start">Connect Kick<span aria-hidden>→</span></a><p className="privacy-note">Private to you. This companion never posts in your chat.</p></div></main>
  );
}

function InvalidOverlayScreen() {
  return <main className="connect-screen"><div className="connect-card invalid-overlay-card"><div className="kick-mark">K</div><p className="eyebrow">Kick streamer companion</p><h1>Overlay unavailable.</h1><p className="connect-copy">Connect Kick to publish widgets here.</p></div></main>;
}

function LoadingScreen() {
  return <main className="connect-screen"><div className="loading-pulse" /></main>;
}

function formatConnectionError(code: string): string {
  const messages: Record<string, string> = {
    account_not_allowed: "This Kick account is not allowed to use this companion.",
    kick_connection_failed: "Kick could not be connected. Check the app and webhook settings.",
    oauth_state_invalid: "The Kick sign-in expired. Please try again.",
    oauth_state_missing: "The Kick sign-in could not be verified. Please try again.",
    owner_already_connected: "A different Kick owner is already connected.",
  };
  return messages[code] ?? "Kick could not be connected.";
}
