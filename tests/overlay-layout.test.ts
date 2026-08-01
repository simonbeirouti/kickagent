import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAY_LAYOUT,
  managedScreenSchema,
  MAX_WIDGET_LABEL_LENGTH,
  MAX_WIDGETS,
  MIN_SLIM_WIDGET_HEIGHT,
  MIN_WIDGET_HEIGHT,
  minWidgetHeight,
  OVERLAY_COLUMNS,
  overlayLayoutSchema,
  parseOverlayLayout,
  parseScreenLayouts,
  screenLayoutsSchema,
  WIDGET_DEFAULTS,
  widgetKindSchema,
  widgetPlacementSchema,
} from "@/lib/overlay-layout";

const fullCanvasLayout = widgetKindSchema.options.map((kind, index) => ({
  height: 2,
  id: kind,
  kind,
  width: 3,
  x: index,
  y: 0,
}));

describe("overlay layout", () => {
  it("accepts widgets placed inside the fixed 24 by 14 canvas", () => {
    expect(overlayLayoutSchema.safeParse(DEFAULT_OVERLAY_LAYOUT).success).toBe(true);
  });

  it("has an in-bounds default placement for every widget kind", () => {
    for (const kind of widgetKindSchema.options) {
      expect(overlayLayoutSchema.safeParse([WIDGET_DEFAULTS[kind]]).success).toBe(true);
    }
  });

  it("accepts a full canvas holding every widget kind at once", () => {
    expect(fullCanvasLayout).toHaveLength(MAX_WIDGETS);
    expect(overlayLayoutSchema.safeParse(fullCanvasLayout).success).toBe(true);
  });

  it("accepts every widget kind on every managed screen, including public", () => {
    const layouts = Object.fromEntries(
      managedScreenSchema.options.map((screen) => [screen, fullCanvasLayout]),
    );
    const parsed = screenLayoutsSchema.parse(layouts);
    for (const screen of managedScreenSchema.options) {
      expect(parsed[screen]?.map((item) => item.kind)).toEqual([...widgetKindSchema.options]);
    }
  });

  it("includes the slim hype bar kind with a wide top-edge default", () => {
    expect(widgetKindSchema.options).toContain("hypeBar");
    const hypeBar = WIDGET_DEFAULTS.hypeBar;
    expect(hypeBar.y).toBe(0);
    expect(hypeBar.height).toBe(MIN_SLIM_WIDGET_HEIGHT);
    // Defaults to roughly 60% of the canvas width, centred.
    expect(hypeBar.width / OVERLAY_COLUMNS).toBeCloseTo(0.6, 1);
    expect(hypeBar.x).toBe(Math.floor((OVERLAY_COLUMNS - hypeBar.width) / 2));
  });

  it("lets only strip widgets shrink to a single row", () => {
    expect(minWidgetHeight("hypeBar")).toBe(MIN_SLIM_WIDGET_HEIGHT);
    expect(minWidgetHeight("hype")).toBe(MIN_WIDGET_HEIGHT);
    expect(
      widgetPlacementSchema.safeParse({ ...WIDGET_DEFAULTS.hypeBar, height: 1 }).success,
    ).toBe(true);
    expect(
      widgetPlacementSchema.safeParse({ ...WIDGET_DEFAULTS.hypeBar, height: 0 }).success,
    ).toBe(false);
    // Card widgets keep the original two-row minimum.
    expect(
      widgetPlacementSchema.safeParse({ ...WIDGET_DEFAULTS.hype, height: 1 }).success,
    ).toBe(false);
    expect(
      overlayLayoutSchema.safeParse([{ ...WIDGET_DEFAULTS.chat, height: 1 }]).success,
    ).toBe(false);
  });

  it("round-trips a custom widget label and rejects invalid ones", () => {
    const labelled = { ...WIDGET_DEFAULTS.hype, label: "Crowd meter" };
    expect(widgetPlacementSchema.parse(labelled).label).toBe("Crowd meter");
    // Layouts saved before the label field existed stay valid.
    expect(widgetPlacementSchema.safeParse(WIDGET_DEFAULTS.hype).success).toBe(true);
    expect(widgetPlacementSchema.safeParse({ ...WIDGET_DEFAULTS.hype, label: "" }).success).toBe(false);
    expect(
      widgetPlacementSchema.safeParse({
        ...WIDGET_DEFAULTS.hype,
        label: "x".repeat(MAX_WIDGET_LABEL_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("keeps per-screen layouts of arbitrary kinds when parsing stored screen layouts", () => {
    const stored = {
      glasses: [WIDGET_DEFAULTS.pulse],
      phone: [WIDGET_DEFAULTS.boss],
      public: fullCanvasLayout,
    };
    const parsed = parseScreenLayouts(stored, DEFAULT_OVERLAY_LAYOUT);
    expect(parsed.glasses?.map((item) => item.kind)).toEqual(["pulse"]);
    expect(parsed.phone?.map((item) => item.kind)).toEqual(["boss"]);
    expect(parsed.public?.map((item) => item.kind)).toEqual([...widgetKindSchema.options]);
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
