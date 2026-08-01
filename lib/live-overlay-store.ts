"use client";

import { useCallback, useEffect, useState } from "react";
import type { OverlayState } from "@/lib/overlay-state";

interface LiveOverlayOptions {
  readonly accessToken?: string;
  readonly publicMode?: boolean;
}

export interface LiveOverlayResult {
  readonly authenticated?: boolean;
  readonly error?: string;
  readonly refresh: (syncKick?: boolean) => Promise<void>;
  readonly state?: OverlayState;
}

export function useLiveOverlayState(options: LiveOverlayOptions = {}): LiveOverlayResult {
  const { accessToken, publicMode = false } = options;
  const [state, setState] = useState<OverlayState>();
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async (syncKick = false) => {
    try {
      const search = new URLSearchParams();
      if (accessToken) search.set("token", accessToken);
      else if (publicMode) search.set("public", "overlay");
      if (syncKick) search.set("sync", "kick");
      const suffix = search.size > 0 ? `?${search}` : "";
      const response = await fetch(`/api/overlay/state${suffix}`, { cache: "no-store" });
      if (response.status === 401) {
        setAuthenticated(false);
        setState(undefined);
        return;
      }
      if (!response.ok) throw new Error("Live stream update failed.");
      setState((await response.json()) as OverlayState);
      setAuthenticated(true);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live stream update failed.");
    }
  }, [accessToken, publicMode]);

  useEffect(() => {
    void refresh(true);
    let refreshCount = 0;
    const timer = window.setInterval(() => {
      refreshCount += 1;
      void refresh(refreshCount % 5 === 0);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { authenticated, error, refresh, state };
}
