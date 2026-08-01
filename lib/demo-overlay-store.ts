"use client";

import { useEffect, useState } from "react";
import { parseOverlayLayout } from "@/lib/overlay-layout";
import type { OverlayState } from "@/lib/overlay-state";

const DEMO_STATE_VERSION = 1;
const DEMO_STATE_STORAGE_KEY = "kickagent-demo-state-v1";
const LEGACY_LAYOUT_STORAGE_KEY = "kickagent-demo-layout";
const DEMO_STATE_EVENT = "kickagent:demo-state";
const DEMO_STATE_CHANNEL = "kickagent-demo-state";

interface StoredDemoState {
  readonly state: OverlayState;
  readonly version: typeof DEMO_STATE_VERSION;
}

export function useDemoOverlayState(initialState: OverlayState): OverlayState {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(readDemoOverlayState(initialState));
    return subscribeToDemoOverlayState(setState);
  }, [initialState]);

  return state;
}

export function readDemoOverlayState(fallback: OverlayState): OverlayState {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(DEMO_STATE_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredDemoState>;
      if (stored.version === DEMO_STATE_VERSION && stored.state) {
        return normalizeDemoState(stored.state, fallback);
      }
    }

    const legacyLayout = window.localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY);
    return legacyLayout
      ? { ...fallback, layout: parseOverlayLayout(JSON.parse(legacyLayout)) }
      : fallback;
  } catch {
    return fallback;
  }
}

export function publishDemoOverlayState(state: OverlayState): OverlayState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (typeof window === "undefined") return next;

  window.localStorage.setItem(
    DEMO_STATE_STORAGE_KEY,
    JSON.stringify({ state: next, version: DEMO_STATE_VERSION } satisfies StoredDemoState),
  );
  window.dispatchEvent(new CustomEvent<OverlayState>(DEMO_STATE_EVENT, { detail: next }));
  const channel = new BroadcastChannel(DEMO_STATE_CHANNEL);
  channel.postMessage(next);
  channel.close();
  return next;
}

export function subscribeToDemoOverlayState(
  onState: (state: OverlayState) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onCustomEvent = (event: Event) => {
    onState((event as CustomEvent<OverlayState>).detail);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== DEMO_STATE_STORAGE_KEY || !event.newValue) return;
    try {
      const stored = JSON.parse(event.newValue) as StoredDemoState;
      if (stored.version === DEMO_STATE_VERSION) onState(stored.state);
    } catch {
      // Ignore malformed data from another tab and keep the last valid state.
    }
  };
  const channel = new BroadcastChannel(DEMO_STATE_CHANNEL);
  const onChannel = (event: MessageEvent<OverlayState>) => onState(event.data);

  window.addEventListener(DEMO_STATE_EVENT, onCustomEvent);
  window.addEventListener("storage", onStorage);
  channel.addEventListener("message", onChannel);
  return () => {
    window.removeEventListener(DEMO_STATE_EVENT, onCustomEvent);
    window.removeEventListener("storage", onStorage);
    channel.removeEventListener("message", onChannel);
    channel.close();
  };
}

function normalizeDemoState(candidate: OverlayState, fallback: OverlayState): OverlayState {
  if (candidate.authenticated !== true || !candidate.channel || !Array.isArray(candidate.messages)) {
    return fallback;
  }
  return {
    ...fallback,
    ...candidate,
    channel: { ...fallback.channel, ...candidate.channel },
    hypeScore: clampNumber(candidate.hypeScore, 0, 100, fallback.hypeScore),
    layout: parseOverlayLayout(candidate.layout),
    messages: candidate.messages.slice(0, 5),
    privateContext: candidate.privateContext ?? fallback.privateContext,
    suggestion: candidate.suggestion ?? fallback.suggestion,
    surfaceContent: candidate.surfaceContent
      ? {
          ...fallback.surfaceContent!,
          ...candidate.surfaceContent,
          widgetLabels: {
            ...fallback.surfaceContent!.widgetLabels,
            ...candidate.surfaceContent.widgetLabels,
          },
        }
      : fallback.surfaceContent,
  };
}

function clampNumber(value: number, minimum: number, maximum: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}
