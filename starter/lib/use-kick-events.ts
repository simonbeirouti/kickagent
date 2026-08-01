"use client";

import { useEffect, useRef, useState } from "react";
import type { KickEvent } from "@/lib/event-bus";

/** KickEvent with the `fake:` prefix stripped into a normalized `kind`. */
export type FeedEvent = KickEvent & { kind: string };

export function normalizeEvent(e: KickEvent): FeedEvent {
  return { ...e, kind: e.type.replace(/^fake:/, "") };
}

/**
 * Subscribes to the app's SSE stream. `onEvent` fires once per event and is
 * kept in a ref so callers can pass a fresh closure every render without
 * tearing down the EventSource.
 */
export function useKickEvents(onEvent?: (e: FeedEvent) => void) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (msg) => {
      const event = normalizeEvent(JSON.parse(msg.data) as KickEvent);
      handlerRef.current?.(event);
    };
    return () => source.close();
  }, []);

  return { connected };
}
