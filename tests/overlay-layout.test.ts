import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAY_LAYOUT,
  MAX_WIDGETS,
  overlayLayoutSchema,
  parseOverlayLayout,
  parseScreenLayouts,
  WIDGET_DEFAULTS,
  widgetKindSchema,
} from "@/lib/overlay-layout";

describe("overlay layout", () => {
  it("accepts widgets placed inside the fixed 24 by 14 canvas", () => {
    expect(overlayLayoutSchema.safeParse(DEFAULT_OVERLAY_LAYOUT).success).toBe(true);
    expect(DEFAULT_OVERLAY_LAYOUT.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["prediction", "actionBet"]),
    );
  });

  it("has an in-bounds default placement for every widget kind", () => {
    for (const kind of widgetKindSchema.options) {
      expect(overlayLayoutSchema.safeParse([WIDGET_DEFAULTS[kind]]).success).toBe(true);
    }
  });

  it("accepts a full canvas holding every widget kind at once", () => {
    const full = widgetKindSchema.options.map((kind, index) => ({
      height: 2,
      id: kind,
      kind,
      width: 3,
      x: index,
      y: 0,
    }));
    expect(full).toHaveLength(MAX_WIDGETS);
    expect(overlayLayoutSchema.safeParse(full).success).toBe(true);
  });

  it("rejects duplicate widget kinds and widgets outside the canvas", () => {
    expect(
      overlayLayoutSchema.safeParse([
        { height: 5, id: "one", kind: "hype", width: 8, x: 0, y: 0 },
        { height: 5, id: "two", kind: "hype", width: 8, x: 20, y: 10 },
      ]).success,
    ).toBe(false);
  });

  it("falls back to the default layout for invalid stored JSON", () => {
    expect(parseOverlayLayout({ broken: true })).toEqual(DEFAULT_OVERLAY_LAYOUT);
  });

  it("recovers layouts that were double-encoded in jsonb", () => {
    const moved = [{ height: 5, id: "hype", kind: "hype" as const, width: 8, x: 2, y: 3 }];

    expect(parseOverlayLayout(JSON.stringify(moved))).toEqual(moved);
    expect(parseScreenLayouts({ public: JSON.stringify(moved) }, DEFAULT_OVERLAY_LAYOUT))
      .toEqual({ public: moved });
  });
});
