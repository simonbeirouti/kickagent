import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActionBetWidget,
  PredictionWidget,
} from "@/app/_components/overlay-widgets";
import { createDemoOverlayState } from "@/lib/overlay-state";

describe("interactive overlay widgets", () => {
  const now = new Date("2026-08-01T04:00:00.000Z");
  const state = createDemoOverlayState(now);

  it("provides serializable prediction and action-bet snapshots", () => {
    const serialized = JSON.parse(JSON.stringify({
      actionBet: state.actionBet,
      prediction: state.prediction,
    }));

    expect(serialized.prediction).toMatchObject({
      participantCount: 14,
      status: "open",
      totalPoints: 700,
    });
    expect(serialized.actionBet).toMatchObject({
      backerCount: 9,
      status: "backing",
      totalPoints: 850,
    });
  });

  it("renders public-overlay cards without viewer controls", () => {
    const prediction = renderToStaticMarkup(createElement(PredictionWidget, { state }));
    const actionBet = renderToStaticMarkup(createElement(ActionBetWidget, { state }));

    expect(prediction).toContain("Will Neon hit 13,000 trophies this stream?");
    expect(prediction).toContain("29%");
    expect(actionBet).toContain("Play the next round using a random character");
    expect(prediction).not.toContain("<button");
    expect(actionBet).not.toContain("<button");
  });
});
