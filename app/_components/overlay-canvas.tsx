"use client";

import {
  ActivityIcon,
  BellRingIcon,
  Clock3Icon,
  CoinsIcon,
  CrownIcon,
  FlameIcon,
  GaugeIcon,
  MessageCircleIcon,
  RadioIcon,
  SkullIcon,
  SmilePlusIcon,
  SparklesIcon,
  TargetIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode, PointerEvent as ReactPointerEvent } from "react";
import {
  AlertsWidget,
  BattleWidget,
  BossWidget,
  EmoteWallWidget,
  GoalsWidget,
  JarWidget,
  LeaderboardWidget,
  PulseWidget,
  WidgetHeader,
} from "@/app/_components/overlay-widgets";
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
import type { OverlayState } from "@/lib/overlay-state";

interface DragPayload {
  readonly id?: string;
  readonly kind: WidgetKind;
  readonly offsetX: number;
  readonly offsetY: number;
}

export const WIDGET_LABELS: Readonly<Record<WidgetKind, string>> = {
  alerts: "Alerts",
  battle: "Hype battle",
  boss: "Stream boss",
  chat: "Latest chat",
  emotes: "Emote wall",
  goals: "Stream goals",
  hype: "Agent energy",
  jar: "Support jar",
  leaderboard: "Top supporters",
  pulse: "Chat pulse",
  suggestion: "Live brief",
};

const WIDGET_ICONS: Readonly<Record<WidgetKind, typeof SparklesIcon>> = {
  alerts: BellRingIcon,
  battle: FlameIcon,
  boss: SkullIcon,
  chat: MessageCircleIcon,
  emotes: SmilePlusIcon,
  goals: TargetIcon,
  hype: ActivityIcon,
  jar: CoinsIcon,
  leaderboard: CrownIcon,
  pulse: GaugeIcon,
  suggestion: SparklesIcon,
};

export function WidgetKindIcon({ kind }: { readonly kind: WidgetKind }) {
  const Icon = WIDGET_ICONS[kind];
  return <Icon size={17} />;
}

/**
 * The shared widget canvas. Renders a 24×14 grid of placed widgets for any
 * managed screen. With `onLayoutChange` the canvas is an editor (drag from the
 * library, per-widget drag, corner resize, remove, rename); without it the
 * canvas is a locked live view — the mode every viewer-facing surface uses.
 */
export function OverlayCanvas({
  embedded = false,
  layout,
  onLayoutChange,
  publicMode = false,
  screen = "public",
  state,
}: {
  readonly embedded?: boolean;
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

  const renameWidget = (placement: WidgetPlacement, rawLabel: string) => {
    if (!onLayoutChange) return;
    const label = rawLabel.trim().slice(0, 48) || undefined;
    if (label === placement.label) return;
    onLayoutChange(
      layout.map((item) => (item.id === placement.id ? { ...item, label } : item)),
    );
  };

  return (
    <div
      className={
        publicMode
          ? `overlay-canvas public${embedded ? " live-embed" : ""}`
          : `overlay-canvas editor screen-${screen}`
      }
      onDragOver={onLayoutChange ? (event) => event.preventDefault() : undefined}
      onDrop={onLayoutChange ? onDrop : undefined}
      ref={canvasRef}
    >
      {layout.map((placement) => (
        <article
          className={`canvas-widget ${publicMode ? "" : "editable"}`}
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
            label={
              onLayoutChange && !publicMode ? (
                <EditableWidgetText
                  ariaLabel={`${WIDGET_LABELS[placement.kind]} widget title`}
                  onCommit={(value) => renameWidget(placement, value)}
                  placeholder={WIDGET_LABELS[placement.kind]}
                  value={placement.label ?? ""}
                />
              ) : (
                placement.label ?? WIDGET_LABELS[placement.kind]
              )
            }
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
  label,
  state,
}: {
  readonly kind: WidgetKind;
  readonly label: ReactNode;
  readonly state: OverlayState;
}) {
  if (kind === "goals") return <GoalsWidget label={label} state={state} />;
  if (kind === "leaderboard") return <LeaderboardWidget label={label} state={state} />;
  if (kind === "battle") return <BattleWidget label={label} state={state} />;
  if (kind === "boss") return <BossWidget label={label} state={state} />;
  if (kind === "jar") return <JarWidget label={label} state={state} />;
  if (kind === "alerts") return <AlertsWidget label={label} state={state} />;
  if (kind === "emotes") return <EmoteWallWidget label={label} state={state} />;
  if (kind === "pulse") return <PulseWidget label={label} state={state} />;
  if (kind === "suggestion") {
    return (
      <div className="canvas-widget-inner suggestion-canvas-widget">
        <WidgetHeader
          icon={<SparklesIcon size={17} />}
          label={label}
        >
          <Freshness generatedAt={state.summary?.generatedAt} stale={state.summary?.stale} />
        </WidgetHeader>
        <div className="suggestion-content">
          <p>{state.summary?.text ?? "Waiting for the first agent brief…"}</p>
        </div>
        <div className="live-cue">
          <span><SparklesIcon size={13} /> Next talking point</span>
          <p>{suggestionText(state)}</p>
        </div>
        <footer className="widget-footer">
          <span>{state.channel.streamTitle || "No stream title"}</span>
          <span>{state.channel.category || "No category"}</span>
        </footer>
      </div>
    );
  }
  if (kind === "chat") {
    return (
      <div className="canvas-widget-inner chat-canvas-widget">
        <WidgetHeader
          icon={<MessageCircleIcon size={17} />}
          label={label}
        >
          <span className="count-badge">{state.messages.length}/5</span>
        </WidgetHeader>
        <div className="message-list">
          {state.messages.length === 0 ? (
            <div className="empty-messages"><RadioIcon size={20} /></div>
          ) : state.messages.map((message) => (
            <div className="chat-message" key={message.id}>
              <span className="chat-user">{message.username}</span>
              <span className="chat-copy">{message.content}</span>
              <time>{relativeTime(message.createdAt)}</time>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // The hype tracker: always driven by the overlay state's live engine fields
  // (hypeScore/hypeReady/hypeTrend) — never a static score in the live path.
  return (
    <div className="canvas-widget-inner hype-canvas-widget">
      <WidgetHeader
        icon={<ActivityIcon size={17} />}
        label={label}
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
          <strong>{state.hypeScore}</strong>
          <span>/ 100</span>
        </div>
        <div className="hype-copy"><ZapIcon size={18} /><span>{hypeLabel(state)}</span></div>
      </div>
    </div>
  );
}

/**
 * Rename field shown in a widget's header while editing. Commits on blur or
 * Enter so each keystroke doesn't PUT the layout; an empty value restores the
 * widget's standard label. Same input pattern (and CSS) as the original
 * dashboard's editable widget text.
 */
function EditableWidgetText({
  ariaLabel,
  onCommit,
  placeholder,
  value,
}: {
  readonly ariaLabel: string;
  readonly onCommit: (value: string) => void;
  readonly placeholder: string;
  readonly value: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={ariaLabel}
      className="editable-widget-text"
      maxLength={48}
      onBlur={() => {
        if (draft !== null) onCommit(draft);
        setDraft(null);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onDragStart={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      placeholder={placeholder}
      value={draft ?? value}
    />
  );
}

function Freshness({ generatedAt, stale }: { readonly generatedAt?: string; readonly stale?: boolean }) {
  return <span className={stale ? "freshness stale" : "freshness"}><Clock3Icon size={13} />{generatedAt ? (stale ? "Delayed" : relativeTime(generatedAt)) : "Waiting"}</span>;
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

export function startLibraryDrag(event: DragEvent<HTMLButtonElement>, kind: WidgetKind) {
  const template = WIDGET_DEFAULTS[kind];
  writeDragPayload(event, { kind, offsetX: Math.floor(template.width / 2), offsetY: Math.floor(template.height / 2) });
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
  return "Listening for a useful moment…";
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}
