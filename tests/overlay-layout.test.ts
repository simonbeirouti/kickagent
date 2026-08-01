import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAY_LAYOUT,
  overlayLayoutSchema,
  parseOverlayLayout,
} from "@/lib/overlay-layout";

describe("overlay layout", () => {
  it("accepts widgets placed inside the fixed 24 by 14 canvas", () => {
    expect(overlayLayoutSchema.safeParse(DEFAULT_OVERLAY_LAYOUT).success).toBe(true);
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
});
