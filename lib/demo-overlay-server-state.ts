import { createDemoOverlayState } from "@/lib/overlay-state";
import type { OverlayState } from "@/lib/overlay-state";

const STORE_KEY = Symbol.for("kickagent.demo-overlay-state");

type DemoOverlayStore = { state: OverlayState };

const globalStore = globalThis as typeof globalThis & {
  [STORE_KEY]?: DemoOverlayStore;
};

function store(): DemoOverlayStore {
  return (globalStore[STORE_KEY] ??= { state: createDemoOverlayState() });
}

export function getDemoOverlayState(): OverlayState {
  return store().state;
}

export function setDemoOverlayState(state: OverlayState): OverlayState {
  store().state = { ...state, updatedAt: new Date().toISOString() };
  return store().state;
}
