"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_OVERLAY_LAYOUT,
  parseOverlayLayout,
  parseScreenLayouts,
  type ManagedScreen,
  type OverlayLayout,
  type ScreenLayouts,
} from "@/lib/overlay-layout";

const STORE_VERSION = 1;
const STORE_KEY_PREFIX = "kickagent-screen-layouts-v1";
const LEGACY_STATE_KEY = "kickagent-demo-state-v2";
const LEGACY_STATE_KEY_V1 = "kickagent-demo-state-v1";
const LEGACY_LAYOUT_KEY = "kickagent-demo-layout";
const LAYOUT_EVENT = "kickagent:screen-layouts";

interface LayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredLayouts {
  readonly layouts: ScreenLayouts;
  readonly version: typeof STORE_VERSION;
}

interface LayoutEventDetail {
  readonly channel: string;
  readonly layouts: ScreenLayouts;
}

export function usePersistedScreenLayouts(
  channel: string | undefined,
  fallback: ScreenLayouts | undefined,
): {
  readonly layouts: ScreenLayouts | undefined;
  readonly persistLayout: (screen: ManagedScreen, layout: OverlayLayout) => void;
} {
  const [layouts, setLayouts] = useState<ScreenLayouts>();

  useEffect(() => {
    if (!channel || !fallback) {
      setLayouts(undefined);
      return;
    }

    const key = storageKey(channel);
    setLayouts(readStoredScreenLayouts(window.localStorage, channel, fallback));

    const onLayoutEvent = (event: Event) => {
      const detail = (event as CustomEvent<LayoutEventDetail>).detail;
      if (detail.channel === channel) setLayouts(detail.layouts);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      const stored = parseStoredLayouts(event.newValue, fallback);
      if (stored) setLayouts(stored);
    };

    window.addEventListener(LAYOUT_EVENT, onLayoutEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LAYOUT_EVENT, onLayoutEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [channel]);

  const persistLayout = useCallback((screen: ManagedScreen, layout: OverlayLayout) => {
    if (!channel) return;
    const next = { ...(layouts ?? fallback), [screen]: layout };
    writeStoredScreenLayouts(window.localStorage, channel, next);
    window.dispatchEvent(new CustomEvent<LayoutEventDetail>(LAYOUT_EVENT, {
      detail: { channel, layouts: next },
    }));
    setLayouts(next);
  }, [channel, fallback, layouts]);

  return { layouts, persistLayout };
}

export function readStoredScreenLayouts(
  storage: LayoutStorage,
  channel: string,
  fallback: ScreenLayouts,
): ScreenLayouts {
  try {
    const current = storage.getItem(storageKey(channel));
    if (current) return parseStoredLayouts(current, fallback) ?? fallback;

    const legacyState = storage.getItem(LEGACY_STATE_KEY) ?? storage.getItem(LEGACY_STATE_KEY_V1);
    if (legacyState) {
      const candidate = JSON.parse(legacyState) as {
        readonly state?: {
          readonly channel?: { readonly slug?: string };
          readonly layout?: unknown;
          readonly screenLayouts?: unknown;
        };
      };
      if (
        candidate.state &&
        (!candidate.state.channel?.slug || candidate.state.channel.slug === channel)
      ) {
        const publicLayout = parseOverlayLayout(candidate.state?.layout ?? fallback.public);
        const layouts = parseScreenLayouts(candidate.state?.screenLayouts, publicLayout);
        writeStoredScreenLayouts(storage, channel, layouts);
        return layouts;
      }
    }

    const legacyLayout = storage.getItem(LEGACY_LAYOUT_KEY);
    if (legacyLayout) {
      const layouts = { ...fallback, public: parseOverlayLayout(JSON.parse(legacyLayout)) };
      writeStoredScreenLayouts(storage, channel, layouts);
      return layouts;
    }
  } catch {
    // Ignore unavailable or malformed storage and keep the server layout.
  }
  return fallback;
}

export function writeStoredScreenLayouts(
  storage: LayoutStorage,
  channel: string,
  layouts: ScreenLayouts,
): void {
  try {
    storage.setItem(
      storageKey(channel),
      JSON.stringify({ layouts, version: STORE_VERSION } satisfies StoredLayouts),
    );
  } catch {
    // The server save can still succeed when browser storage is unavailable.
  }
}

function parseStoredLayouts(value: string, fallback: ScreenLayouts): ScreenLayouts | undefined {
  try {
    const stored = JSON.parse(value) as Partial<StoredLayouts>;
    if (stored.version !== STORE_VERSION || !stored.layouts) return undefined;
    return parseScreenLayouts(
      stored.layouts,
      fallback.public ?? DEFAULT_OVERLAY_LAYOUT,
    );
  } catch {
    return undefined;
  }
}

function storageKey(channel: string): string {
  return `${STORE_KEY_PREFIX}:${encodeURIComponent(channel)}`;
}
