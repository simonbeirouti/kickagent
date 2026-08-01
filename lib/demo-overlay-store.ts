"use client";

import { useEffect, useState } from "react";
import { parseOverlayLayout } from "@/lib/overlay-layout";
import type { OverlayState } from "@/lib/overlay-state";

const STATE_VERSION = 2;
const STORAGE_KEY = "kickagent-demo-state-v2";
const LEGACY_STORAGE_KEY = "kickagent-demo-state-v1";
const LEGACY_LAYOUT_KEY = "kickagent-demo-layout";
const STATE_EVENT = "kickagent:demo-state";

interface StoredState {
  readonly state: OverlayState;
  readonly version: typeof STATE_VERSION;
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
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) {
      const stored = JSON.parse(current) as Partial<StoredState>;
      if (stored.version === STATE_VERSION && stored.state) {
        return normalizeState(stored.state, fallback);
      }
    }

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const stored = JSON.parse(legacy) as { readonly state?: OverlayState };
      if (stored.state) return normalizeState(stored.state, fallback);
    }

    const legacyLayout = window.localStorage.getItem(LEGACY_LAYOUT_KEY);
    return legacyLayout
      ? { ...fallback, layout: parseOverlayLayout(JSON.parse(legacyLayout)) }
      : fallback;
  } catch {
    return fallback;
  }
}

export function publishDemoOverlayState(state: OverlayState): OverlayState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: next, version: STATE_VERSION } satisfies StoredState),
  );
  window.dispatchEvent(new CustomEvent<OverlayState>(STATE_EVENT, { detail: next }));
  return next;
}

function subscribeToDemoOverlayState(onState: (state: OverlayState) => void): () => void {
  const onCustomEvent = (event: Event) => onState((event as CustomEvent<OverlayState>).detail);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const stored = JSON.parse(event.newValue) as StoredState;
      if (stored.version === STATE_VERSION) onState(stored.state);
    } catch {
      // Keep the last valid state if another tab writes malformed data.
    }
  };
  window.addEventListener(STATE_EVENT, onCustomEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(STATE_EVENT, onCustomEvent);
    window.removeEventListener("storage", onStorage);
  };
}

function normalizeState(candidate: OverlayState, fallback: OverlayState): OverlayState {
  if (candidate.authenticated !== true || !candidate.channel || !Array.isArray(candidate.messages)) {
    return fallback;
  }
  const layout = parseOverlayLayout(candidate.layout);
  return {
    ...fallback,
    ...candidate,
    channel: { ...fallback.channel, ...candidate.channel },
    hypeScore: clamp(candidate.hypeScore, 0, 100, fallback.hypeScore),
    layout,
    messages: candidate.messages.slice(0, 5),
    screenLayouts: {
      glasses: candidate.screenLayouts?.glasses
        ? parseOverlayLayout(candidate.screenLayouts.glasses)
        : fallback.screenLayouts?.glasses,
      phone: candidate.screenLayouts?.phone
        ? parseOverlayLayout(candidate.screenLayouts.phone)
        : fallback.screenLayouts?.phone,
      public: candidate.screenLayouts?.public
        ? parseOverlayLayout(candidate.screenLayouts.public)
        : layout,
    },
    suggestion: candidate.suggestion ?? fallback.suggestion,
    summary: candidate.summary ?? fallback.summary,
  };
}

function clamp(value: number, minimum: number, maximum: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}
