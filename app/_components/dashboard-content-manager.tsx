"use client";

import {
  ExternalLinkIcon,
  GlassesIcon,
  MonitorUpIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { createDemoOverlayState, type OverlayState } from "@/lib/overlay-state";

type ManagedSurface = "glasses" | "phone" | "public";

const SURFACES: readonly {
  readonly href: string;
  readonly icon: typeof GlassesIcon;
  readonly id: ManagedSurface;
  readonly label: string;
}[] = [
  { href: "/glasses", icon: GlassesIcon, id: "glasses", label: "Glasses" },
  { href: "/streamer", icon: SmartphoneIcon, id: "phone", label: "Streamer phone" },
  { href: "/public/overlay", icon: MonitorUpIcon, id: "public", label: "Public overlay" },
];

export function DashboardContentManager({
  onChange,
  publicEditor,
  state,
}: {
  readonly onChange: (state: OverlayState) => void;
  readonly publicEditor: ReactNode;
  readonly state: OverlayState;
}) {
  const [surface, setSurface] = useState<ManagedSurface>("glasses");
  const [glassesCue, setGlassesCue] = useState(0);
  const surfaceContent = state.surfaceContent ?? createDemoOverlayState().surfaceContent!;
  const selectedSurface = SURFACES.find((item) => item.id === surface)!;

  const updateSurfaceContent = (
    changes: Partial<NonNullable<OverlayState["surfaceContent"]>>,
  ) => onChange({ ...state, surfaceContent: { ...surfaceContent, ...changes } });

  const updateLabel = (
    label: keyof NonNullable<OverlayState["surfaceContent"]>["widgetLabels"],
    value: string,
  ) => updateSurfaceContent({
    widgetLabels: { ...surfaceContent.widgetLabels, [label]: value },
  });

  const updateGlassesCue = (value: string) => {
    const glassesCues = [...surfaceContent.glassesCues];
    glassesCues[glassesCue] = value;
    updateSurfaceContent({ glassesCues });
  };

  const updatePrivate = (field: "headline" | "note", value: string) => {
    const notes = [...(state.privateContext?.notes ?? [])];
    if (field === "note") notes[0] = value;
    onChange({
      ...state,
      privateContext: {
        headline: field === "headline" ? value : state.privateContext?.headline ?? "",
        notes,
      },
    });
  };

  const updatePhoneTopic = (index: number, field: "label" | "percentage", value: string) => {
    updateSurfaceContent({
      phoneTopics: surfaceContent.phoneTopics.map((topic, topicIndex) =>
        topicIndex === index
          ? {
              ...topic,
              [field]: field === "percentage" ? clampPercentage(Number(value)) : value,
            }
          : topic,
      ),
    });
  };

  return (
    <section className="widget-manager">
      <header className="widget-manager-toolbar">
        <nav aria-label="Editable overlay" className="widget-surface-tabs">
          {SURFACES.map(({ icon: Icon, id, label }) => (
            <button
              aria-pressed={surface === id}
              className={surface === id ? "active" : undefined}
              key={id}
              onClick={() => setSurface(id)}
              type="button"
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
        <a href={selectedSurface.href} rel="noreferrer" target="_blank">
          Open live page <ExternalLinkIcon size={14} />
        </a>
      </header>

      {surface === "glasses" ? (
        <div className="direct-overlay-canvas glasses-widget-canvas">
          <article className="direct-widget glasses-private-editor">
            <input
              aria-label="Glasses private widget title"
              className="direct-widget-label"
              onChange={(event) => updateLabel("glassesPrivate", event.target.value)}
              value={surfaceContent.widgetLabels.glassesPrivate}
            />
            <textarea
              aria-label="Glasses private headline"
              className="direct-widget-heading"
              onChange={(event) => updatePrivate("headline", event.target.value)}
              rows={2}
              value={state.privateContext?.headline ?? ""}
            />
            <input
              aria-label="Glasses private note"
              className="direct-widget-copy"
              onChange={(event) => updatePrivate("note", event.target.value)}
              value={state.privateContext?.notes[0] ?? ""}
            />
          </article>

          <article className="direct-widget glasses-suggestion-editor">
            <div className="direct-widget-title-row">
              <input
                aria-label="Glasses suggestion widget title"
                className="direct-widget-label accent"
                onChange={(event) => updateLabel("glassesSuggestion", event.target.value)}
                value={surfaceContent.widgetLabels.glassesSuggestion}
              />
              <div className="cue-switcher" role="group" aria-label="Glasses cues">
                {surfaceContent.glassesCues.map((_, index) => (
                  <button
                    aria-pressed={glassesCue === index}
                    key={index}
                    onClick={() => setGlassesCue(index)}
                    type="button"
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              aria-label={`Glasses cue ${glassesCue + 1}`}
              className="direct-widget-prompt"
              onChange={(event) => updateGlassesCue(event.target.value)}
              rows={3}
              value={surfaceContent.glassesCues[glassesCue] ?? ""}
            />
            <span className="direct-widget-derived">{suggestionBasis(state)}</span>
          </article>
        </div>
      ) : null}

      {surface === "phone" ? (
        <div className="direct-overlay-canvas phone-widget-canvas">
          <div className="phone-widget-editor-device">
            <article className="direct-widget phone-pulse-editor">
              <input
                aria-label="Phone pulse widget title"
                className="direct-widget-label"
                onChange={(event) => updateLabel("phonePulse", event.target.value)}
                value={surfaceContent.widgetLabels.phonePulse}
              />
              <div className="phone-editor-metric">
                <input
                  aria-label="Hype score"
                  max="100"
                  min="0"
                  onChange={(event) => onChange({ ...state, hypeScore: Number(event.target.value) })}
                  type="number"
                  value={state.hypeScore}
                />
                <input
                  aria-label="Viewer count"
                  onChange={(event) => updateSurfaceContent({ viewerCount: event.target.value })}
                  value={surfaceContent.viewerCount}
                />
              </div>
            </article>

            <article className="direct-widget phone-suggestion-editor">
              <input
                aria-label="Phone suggestion widget title"
                className="direct-widget-label accent"
                onChange={(event) => updateLabel("phoneSuggestion", event.target.value)}
                value={surfaceContent.widgetLabels.phoneSuggestion}
              />
              <textarea
                aria-label="Phone suggestion"
                className="direct-widget-prompt"
                onChange={(event) => onChange({
                  ...state,
                  suggestion: state.suggestion
                    ? { ...state.suggestion, text: event.target.value }
                    : null,
                })}
                rows={3}
                value={state.suggestion?.text ?? ""}
              />
            </article>

            <article className="direct-widget phone-topics-editor">
              <input
                aria-label="Phone topics widget title"
                className="direct-widget-label"
                onChange={(event) => updateLabel("phoneTopics", event.target.value)}
                value={surfaceContent.widgetLabels.phoneTopics}
              />
              {surfaceContent.phoneTopics.map((topic, index) => (
                <div className="phone-editor-topic" key={index}>
                  <input aria-label={`Phone topic ${index + 1}`} onChange={(event) => updatePhoneTopic(index, "label", event.target.value)} value={topic.label} />
                  <input aria-label={`Phone topic ${index + 1} percentage`} max="100" min="0" onChange={(event) => updatePhoneTopic(index, "percentage", event.target.value)} type="number" value={topic.percentage} />
                </div>
              ))}
            </article>
          </div>
        </div>
      ) : null}

      {surface === "public" ? publicEditor : null}
    </section>
  );
}

function suggestionBasis(state: OverlayState): string {
  if (state.suggestion?.basis === "chat") return "Based on live chat";
  if (state.suggestion?.basis === "stream_context") return "Based on stream context";
  return "Waiting for context";
}

function clampPercentage(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}
