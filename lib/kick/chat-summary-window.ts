const WINDOW_MS = 20_000;

export function nextChatSummaryWindow(date: Date): { readonly end: Date; readonly start: Date } {
  const end = new Date(Math.floor(date.getTime() / WINDOW_MS) * WINDOW_MS + WINDOW_MS);
  return { end, start: new Date(end.getTime() - WINDOW_MS) };
}
