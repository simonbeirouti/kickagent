import { z } from "zod";

export const OVERLAY_COLUMNS = 24;
export const OVERLAY_ROWS = 14;

export const widgetKindSchema = z.enum(["suggestion", "chat", "hype"]);
export type WidgetKind = z.infer<typeof widgetKindSchema>;

export const widgetPlacementSchema = z
  .object({
    height: z.number().int().min(2).max(OVERLAY_ROWS),
    id: z.string().min(1).max(64),
    kind: widgetKindSchema,
    width: z.number().int().min(3).max(OVERLAY_COLUMNS),
    x: z.number().int().min(0).max(OVERLAY_COLUMNS - 1),
    y: z.number().int().min(0).max(OVERLAY_ROWS - 1),
  })
  .refine((item) => item.x + item.width <= OVERLAY_COLUMNS, "Widget exceeds canvas width.")
  .refine((item) => item.y + item.height <= OVERLAY_ROWS, "Widget exceeds canvas height.");

export const overlayLayoutSchema = z
  .array(widgetPlacementSchema)
  .max(3)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
    message: "Widget IDs must be unique.",
  })
  .refine((items) => new Set(items.map((item) => item.kind)).size === items.length, {
    message: "Each widget can only be added once.",
  });

export type OverlayLayout = z.infer<typeof overlayLayoutSchema>;
export type WidgetPlacement = z.infer<typeof widgetPlacementSchema>;

export const DEFAULT_OVERLAY_LAYOUT: OverlayLayout = [
  { height: 10, id: "suggestion", kind: "suggestion", width: 14, x: 1, y: 2 },
  { height: 6, id: "chat", kind: "chat", width: 8, x: 16, y: 1 },
  { height: 5, id: "hype", kind: "hype", width: 8, x: 16, y: 8 },
];

export const WIDGET_DEFAULTS: Readonly<Record<WidgetKind, WidgetPlacement>> = {
  chat: { height: 6, id: "chat", kind: "chat", width: 8, x: 16, y: 1 },
  hype: { height: 5, id: "hype", kind: "hype", width: 8, x: 16, y: 8 },
  suggestion: { height: 10, id: "suggestion", kind: "suggestion", width: 14, x: 1, y: 2 },
};

export function parseOverlayLayout(value: unknown): OverlayLayout {
  const parsed = overlayLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_OVERLAY_LAYOUT;
}
