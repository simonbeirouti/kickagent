import { describe, expect, it } from "vitest";
import {
  readStoredScreenLayouts,
  writeStoredScreenLayouts,
} from "@/lib/overlay-layout-store";
import { DEFAULT_OVERLAY_LAYOUT, type ScreenLayouts } from "@/lib/overlay-layout";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("overlay layout local storage", () => {
  it("restores moved public widgets after a reload", () => {
    const storage = new MemoryStorage();
    const moved = [{ height: 5, id: "hype", kind: "hype" as const, width: 8, x: 2, y: 3 }];
    const layouts: ScreenLayouts = { public: moved };

    writeStoredScreenLayouts(storage, "bsimon", layouts);

    expect(readStoredScreenLayouts(storage, "bsimon", { public: DEFAULT_OVERLAY_LAYOUT }))
      .toEqual(layouts);
  });

  it("keeps layouts isolated per channel", () => {
    const storage = new MemoryStorage();
    const moved = [{ height: 5, id: "hype", kind: "hype" as const, width: 8, x: 2, y: 3 }];
    writeStoredScreenLayouts(storage, "first-channel", { public: moved });

    expect(readStoredScreenLayouts(storage, "second-channel", { public: DEFAULT_OVERLAY_LAYOUT }))
      .toEqual({ public: DEFAULT_OVERLAY_LAYOUT });
  });

  it("migrates the existing demo-state layout", () => {
    const storage = new MemoryStorage();
    const moved = [{ height: 5, id: "hype", kind: "hype" as const, width: 8, x: 2, y: 3 }];
    storage.setItem("kickagent-demo-state-v2", JSON.stringify({
      state: {
        channel: { slug: "bsimon" },
        layout: moved,
        screenLayouts: { public: moved },
      },
      version: 2,
    }));

    expect(readStoredScreenLayouts(storage, "bsimon", { public: DEFAULT_OVERLAY_LAYOUT }))
      .toEqual({ public: moved });
  });
});
