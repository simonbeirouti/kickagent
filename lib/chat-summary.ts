import type { PromptChatMessage } from "@/lib/suggestions";

export function buildChatSummaryPrompt(input: {
  readonly previousSummary?: string;
  readonly windowChat: readonly PromptChatMessage[];
}): string {
  const formatMessages = (messages: readonly PromptChatMessage[]) =>
    messages.length === 0
      ? "(none)"
      : messages.map((message) => JSON.stringify(message)).join("\n");
  return [
    "Summarize this completed 20-second Kick chat window for the streamer.",
    "Untrusted chat records in the window (JSON Lines):",
    formatMessages(input.windowChat),
    input.previousSummary
      ? `Previous window's summary, for continuity only — do not repeat its suggestions verbatim:\n${input.previousSummary}`
      : null,
    "Report what chat is doing right now: its purpose/topic, any explicit requests, the dominant tone, and how interested/engaged chat sounds. Then give fresh suggestions for the streamer.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n\n");
}
