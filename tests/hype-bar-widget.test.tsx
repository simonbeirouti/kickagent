/**
 * Render smoke for the slim hype bar widget: places a hypeBar on a
 * public-mode canvas (the exact component the public overlay route serves)
 * and asserts the markup the browser receives — live-score fill vars, band
 * colour blend, tick marks and the Live/Preview/Calibrating badge states.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverlayCanvas } from "@/app/_components/overlay-canvas";
import { HypeBarWidget, hypeBarColor } from "@/app/_components/overlay-widgets";
import { WIDGET_DEFAULTS } from "@/lib/overlay-layout";
import { createDemoOverlayState, type OverlayState } from "@/lib/overlay-state";

function liveState(overrides: Partial<OverlayState> = {}): OverlayState {
  return { ...createDemoOverlayState(), hypeReady: true, ingestionEnabled: true, ...overrides };
}

describe("hype bar widget", () => {
  it("renders on a public-mode canvas with the live score driving the fill", () => {
    const html = renderToStaticMarkup(
      <OverlayCanvas
        layout={[WIDGET_DEFAULTS.hypeBar]}
        publicMode
        state={liveState({ hypeScore: 84, hypeTrend: "rising" })}
      />,
    );
    expect(html).toContain("hypebar-canvas-widget");
    expect(html).toContain("--bar-width:84%");
    expect(html).toContain("Hype score 84 out of 100");
    expect(html).toContain(">Live<");
    // Band blend: 84 sits between kick green (70) and white-hot (100).
    expect(html).toContain(hypeBarColor(84));
    // Ticks every 10 from 0 to 100.
    expect(html.match(/hypebar-ticks/g)).toHaveLength(1);
    expect((html.match(/left:\d+%/g) ?? []).length).toBeGreaterThanOrEqual(11);
  });

  it("marks the calibrating state while the baseline is still learning", () => {
    const html = renderToStaticMarkup(
      <HypeBarWidget state={liveState({ hypeReady: false, hypeScore: 18 })} />,
    );
    expect(html).toContain("calibrating");
    expect(html).toContain(">Calibrating<");
  });

  it("labels sample data as a preview like the hype widget does", () => {
    const html = renderToStaticMarkup(
      <HypeBarWidget state={liveState({ ingestionEnabled: false })} />,
    );
    expect(html).toContain(">Preview<");
  });

  it("blends the fill colour across the score bands", () => {
    expect(hypeBarColor(0)).toBe("rgb(90 110 117)");
    expect(hypeBarColor(35)).toBe("rgb(255 176 32)");
    expect(hypeBarColor(70)).toBe("rgb(83 252 24)");
    expect(hypeBarColor(100)).toBe("rgb(182 255 143)");
    // Midpoints interpolate instead of snapping between bands.
    expect(hypeBarColor(52.5)).toBe("rgb(169 214 28)");
  });
});
