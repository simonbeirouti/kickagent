"use client";

import { useEffect, useState } from "react";

/**
 * `?overlay=1` strips nav and demo controls so the page can be dropped into
 * OBS as a browser source. Read on mount to avoid useSearchParams' Suspense
 * requirement.
 */
export function useOverlayMode(): boolean {
  const [overlay, setOverlay] = useState(false);
  useEffect(() => {
    setOverlay(new URLSearchParams(window.location.search).has("overlay"));
  }, []);
  return overlay;
}
