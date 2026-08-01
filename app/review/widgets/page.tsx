import {
  ActionBetWidget,
  PredictionWidget,
} from "@/app/_components/overlay-widgets";
import { createDemoOverlayState } from "@/lib/overlay-state";

export default function InteractiveWidgetReviewPage() {
  const now = new Date();
  const demoState = createDemoOverlayState(now);
  const state = {
    ...demoState,
    prediction: demoState.prediction
      ? {
          ...demoState.prediction,
          locksAt: new Date(now.getTime() + 60_000).toISOString(),
        }
      : null,
  };

  return (
    <main className="widget-review-shell">
      <header className="widget-review-heading">
        <p className="eyebrow">Overlay integration review</p>
        <h1>Prediction and Action Bet</h1>
        <p>
          Read-only public-overlay cards driven by the same serializable state contract used by
          the widget canvas.
        </p>
      </header>
      <section className="widget-review-grid">
        <article className="canvas-widget widget-review-card">
          <PredictionWidget state={state} />
        </article>
        <article className="canvas-widget widget-review-card">
          <ActionBetWidget state={state} />
        </article>
      </section>
      <p className="widget-review-note">
        Viewer voting and backing controls intentionally live outside the public overlay. Connect
        the API snapshots to <code>OverlayState.prediction</code> and
        <code> OverlayState.actionBet</code> when the persistent interaction service is ready.
      </p>
    </main>
  );
}
