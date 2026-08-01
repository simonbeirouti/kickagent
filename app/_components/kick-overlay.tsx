"use client";

import {
  ActivityIcon,
  Clock3Icon,
  LogOutIcon,
  MessageCircleIcon,
  RadioIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface OverlayState {
  readonly authenticated: true;
  readonly channel: {
    readonly category: string | null;
    readonly displayName: string;
    readonly profilePicture: string | null;
    readonly slug: string;
    readonly streamTitle: string | null;
  };
  readonly connected: boolean;
  readonly hypeScore: number;
  readonly live: boolean;
  readonly messages: readonly {
    readonly content: string;
    readonly createdAt: string;
    readonly id: string;
    readonly username: string;
  }[];
  readonly suggestion: {
    readonly basis: "chat" | "stream_context" | null;
    readonly generatedAt: string;
    readonly stale: boolean;
    readonly text: string;
  } | null;
  readonly updatedAt: string;
}

export function KickOverlay() {
  const [state, setState] = useState<OverlayState>();
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [error, setError] = useState<string>();
  const [disconnecting, setDisconnecting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/overlay/state", { cache: "no-store" });
      if (response.status === 401) {
        setAuthenticated(false);
        setState(undefined);
        return;
      }
      if (!response.ok) throw new Error("Overlay update failed.");
      setState((await response.json()) as OverlayState);
      setAuthenticated(true);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Overlay update failed.");
    }
  }, []);

  useEffect(() => {
    const queryError = new URLSearchParams(window.location.search).get("error");
    if (queryError) setError(formatConnectionError(queryError));
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

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
  if (!authenticated || !state) return <ConnectScreen error={error} />;

  return (
    <main className="overlay-shell">
      <header className="overlay-header">
        <div className="channel-identity">
          {state.channel.profilePicture ? (
            <img alt="" className="channel-avatar" src={state.channel.profilePicture} />
          ) : (
            <span className="channel-avatar channel-avatar-fallback">K</span>
          )}
          <div>
            <p className="eyebrow">Streamer companion</p>
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

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="widget-grid">
        <article className="widget suggestion-widget">
          <WidgetHeader icon={<SparklesIcon size={17} />} label="Next talking point">
            <Freshness generatedAt={state.suggestion?.generatedAt} stale={state.suggestion?.stale} />
          </WidgetHeader>
          <div className="suggestion-content">
            <p>{suggestionText(state)}</p>
          </div>
          <footer className="widget-footer">
            <span>{state.channel.streamTitle || "No stream title"}</span>
            <span>{state.channel.category || "No category"}</span>
          </footer>
        </article>

        <article className="widget chat-widget">
          <WidgetHeader icon={<MessageCircleIcon size={17} />} label="Latest chat">
            <span className="count-badge">{state.messages.length}/5</span>
          </WidgetHeader>
          <div className="message-list">
            {state.messages.length === 0 ? (
              <div className="empty-messages">
                <RadioIcon size={20} />
                <span>Listening for chat…</span>
              </div>
            ) : (
              state.messages.map((message) => (
                <div className="chat-message" key={message.id}>
                  <span className="chat-user">{message.username}</span>
                  <span className="chat-copy">{message.content}</span>
                  <time>{relativeTime(message.createdAt)}</time>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="widget hype-widget">
          <WidgetHeader icon={<ActivityIcon size={17} />} label="Hype score">
            <span className="preview-badge">Preview</span>
          </WidgetHeader>
          <div className="hype-content">
            <div
              aria-label={`Hype score ${state.hypeScore} out of 100`}
              className="hype-ring"
              style={{ "--hype": `${state.hypeScore * 3.6}deg` } as React.CSSProperties}
            >
              <strong>{state.hypeScore}</strong>
              <span>/ 100</span>
            </div>
            <div className="hype-copy">
              <ZapIcon size={18} />
              <span>Good energy</span>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function WidgetHeader({
  children,
  icon,
  label,
}: {
  readonly children: React.ReactNode;
  readonly icon: React.ReactNode;
  readonly label: string;
}) {
  return (
    <header className="widget-header">
      <span className="widget-title">
        {icon}
        {label}
      </span>
      {children}
    </header>
  );
}

function StatusPill({ live }: { readonly live: boolean }) {
  return (
    <span className={live ? "status-pill live" : "status-pill offline"}>
      <span className="status-dot" />
      {live ? "Live" : "Offline"}
    </span>
  );
}

function Freshness({ generatedAt, stale }: { generatedAt?: string; stale?: boolean }) {
  return (
    <span className={stale ? "freshness stale" : "freshness"}>
      <Clock3Icon size={13} />
      {generatedAt ? (stale ? "Delayed" : relativeTime(generatedAt)) : "Waiting"}
    </span>
  );
}

function suggestionText(state: OverlayState): string {
  if (state.suggestion?.text) return state.suggestion.text;
  if (!state.live) return "Go live when you're ready — your next talking point will appear here.";
  return "Listening to the room and preparing your first talking point…";
}

function ConnectScreen({ error }: { readonly error?: string }) {
  return (
    <main className="connect-screen">
      <div className="connect-card">
        <div className="kick-mark">K</div>
        <p className="eyebrow">Kick streamer companion</p>
        <h1>Stay present. We’ll watch the room.</h1>
        <p className="connect-copy">
          Get a fresh talking point every 30 seconds, keep the latest chat close, and never lose the
          energy of your stream.
        </p>
        {error ? <div className="connect-error">{error}</div> : null}
        <a className="connect-button" href="/api/auth/kick/start">
          Connect Kick
          <span aria-hidden>→</span>
        </a>
        <p className="privacy-note">Private to you. This companion never posts in your chat.</p>
      </div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="connect-screen">
      <div className="loading-pulse" />
    </main>
  );
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
    owner_already_connected: "A different Kick owner is already connected.",
  };
  return messages[code] ?? "Kick could not be connected.";
}
