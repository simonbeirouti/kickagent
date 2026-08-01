"use client";

import {
  ExternalLinkIcon,
  GlassesIcon,
  GripVerticalIcon,
  HandshakeIcon,
  LogOutIcon,
  MonitorUpIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  OverlayCanvas,
  startLibraryDrag,
  WIDGET_LABELS,
  WidgetKindIcon,
} from "@/app/_components/overlay-canvas";
import { useLiveOverlayState } from "@/lib/live-overlay-store";
import {
  WIDGET_DEFAULTS,
  widgetKindSchema,
  type ManagedScreen,
  type OverlayLayout,
  type WidgetKind,
} from "@/lib/overlay-layout";
import { usePersistedScreenLayouts } from "@/lib/overlay-layout-store";

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

const WIDGET_GROUPS: readonly {
  readonly kinds: readonly WidgetKind[];
  readonly label: string;
}[] = [
  { kinds: ["suggestion", "chat", "hype"], label: "Agent" },
  { kinds: ["prediction", "actionBet"], label: "Interactive" },
  { kinds: ["goals", "leaderboard", "jar", "alerts"], label: "Community" },
  { kinds: ["battle", "boss", "emotes", "pulse"], label: "Hype & fun" },
];

// Compile-time guarantee that the library exposes every widget kind.
const LIBRARY_KINDS: readonly WidgetKind[] = WIDGET_GROUPS.flatMap((group) => group.kinds);
if (process.env.NODE_ENV !== "production") {
  for (const kind of widgetKindSchema.options) {
    if (!LIBRARY_KINDS.includes(kind)) {
      throw new Error(`Widget kind "${kind}" is missing from the studio library.`);
    }
  }
}

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

function StatusPill({ live }: { readonly live: boolean }) {
  return <span className={live ? "status-pill live" : "status-pill offline"}><span className="status-dot" />{live ? "Live" : "Offline"}</span>;
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
  };
  return messages[code] ?? "Kick could not be connected.";
}
