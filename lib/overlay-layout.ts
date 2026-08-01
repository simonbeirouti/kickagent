import { z } from "zod";

export const OVERLAY_COLUMNS = 24;
export const OVERLAY_ROWS = 14;
export const MIN_WIDGET_WIDTH = 3;
export const MIN_WIDGET_HEIGHT = 2;

export const widgetKindSchema = z.enum([
  "suggestion",
  "chat",
  "hype",
  "goals",
  "leaderboard",
  "battle",
  "boss",
  "jar",
  "alerts",
  "emotes",
  "pulse",
]);
export type WidgetKind = z.infer<typeof widgetKindSchema>;
export const managedScreenSchema = z.enum(["glasses", "phone", "public"]);
export type ManagedScreen = z.infer<typeof managedScreenSchema>;

// One widget per kind, so a layout can never hold more than the kind count.
export const MAX_WIDGETS = widgetKindSchema.options.length;

export const MAX_WIDGET_LABEL_LENGTH = 48;

export const widgetPlacementSchema = z
  .object({
    height: z.number().int().min(MIN_WIDGET_HEIGHT).max(OVERLAY_ROWS),
    id: z.string().min(1).max(64),
    kind: widgetKindSchema,
    // Streamer-set display title; widgets fall back to their standard label.
    label: z.string().trim().min(1).max(MAX_WIDGET_LABEL_LENGTH).optional(),
    width: z.number().int().min(MIN_WIDGET_WIDTH).max(OVERLAY_COLUMNS),
    x: z.number().int().min(0).max(OVERLAY_COLUMNS - 1),
    y: z.number().int().min(0).max(OVERLAY_ROWS - 1),
  })
  .refine((item) => item.x + item.width <= OVERLAY_COLUMNS, "Widget exceeds canvas width.")
  .refine((item) => item.y + item.height <= OVERLAY_ROWS, "Widget exceeds canvas height.");

export const overlayLayoutSchema = z
  .array(widgetPlacementSchema)
  .max(MAX_WIDGETS)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
    message: "Widget IDs must be unique.",
  })
  .refine((items) => new Set(items.map((item) => item.kind)).size === items.length, {
    message: "Each widget can only be added once.",
  });

export type OverlayLayout = z.infer<typeof overlayLayoutSchema>;
export type WidgetPlacement = z.infer<typeof widgetPlacementSchema>;

export const screenLayoutsSchema = z.object({
  glasses: overlayLayoutSchema.optional(),
  phone: overlayLayoutSchema.optional(),
  public: overlayLayoutSchema.optional(),
});
export type ScreenLayouts = z.infer<typeof screenLayoutsSchema>;

export const DEFAULT_OVERLAY_LAYOUT: OverlayLayout = [
  { height: 10, id: "suggestion", kind: "suggestion", width: 14, x: 1, y: 2 },
  { height: 6, id: "chat", kind: "chat", width: 8, x: 16, y: 1 },
  { height: 5, id: "hype", kind: "hype", width: 8, x: 16, y: 8 },
];

export const WIDGET_DEFAULTS: Readonly<Record<WidgetKind, WidgetPlacement>> = {
  alerts: { height: 5, id: "alerts", kind: "alerts", width: 7, x: 8, y: 0 },
  battle: { height: 4, id: "battle", kind: "battle", width: 10, x: 7, y: 10 },
  boss: { height: 6, id: "boss", kind: "boss", width: 7, x: 0, y: 8 },
  chat: { height: 6, id: "chat", kind: "chat", width: 8, x: 16, y: 1 },
  emotes: { height: 8, id: "emotes", kind: "emotes", width: 6, x: 0, y: 3 },
  goals: { height: 6, id: "goals", kind: "goals", width: 8, x: 0, y: 0 },
  hype: { height: 5, id: "hype", kind: "hype", width: 8, x: 16, y: 8 },
  jar: { height: 7, id: "jar", kind: "jar", width: 5, x: 10, y: 4 },
  leaderboard: { height: 7, id: "leaderboard", kind: "leaderboard", width: 7, x: 16, y: 0 },
  pulse: { height: 6, id: "pulse", kind: "pulse", width: 8, x: 8, y: 8 },
  suggestion: { height: 10, id: "suggestion", kind: "suggestion", width: 14, x: 1, y: 2 },
};

export function parseOverlayLayout(value: unknown): OverlayLayout {
  const parsed = overlayLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_OVERLAY_LAYOUT;
}

export function parseScreenLayouts(value: unknown, publicLayout: OverlayLayout): ScreenLayouts {
  const parsed = screenLayoutsSchema.safeParse(value);
  return parsed.success ? { ...parsed.data, public: parsed.data.public ?? publicLayout } : {
    public: publicLayout,
  };
}
