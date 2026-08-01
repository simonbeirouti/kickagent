import type { HypeSnapshot } from "@/lib/hype";

export interface PromptChatMessage {
  readonly content: string;
  readonly createdAt: string;
  readonly messageId?: string;
  readonly profilePicture?: string;
  readonly senderUserId?: string;
  readonly username: string;
}

export function buildSuggestionPrompt(input: {
  readonly categoryName?: string;
  readonly hype?: HypeSnapshot;
  readonly recentChat: readonly PromptChatMessage[];
  readonly recentSuggestions: readonly string[];
  readonly streamTitle?: string;
  readonly windowChat: readonly PromptChatMessage[];
}): string {
  const formatMessages = (messages: readonly PromptChatMessage[]) =>
    messages.length === 0
      ? "(none)"
      : messages.map((message) => JSON.stringify(message)).join("\n");
  return [
    "Create a live brief and the streamer's next talking-point cue.",
    `Stream title: ${input.streamTitle || "Untitled stream"}`,
    `Category: ${input.categoryName || "Unspecified"}`,
    formatHypeLine(input.hype),
    "Untrusted chat records in the completed 30-second window (JSON Lines):",
    formatMessages(input.windowChat),
    "Recent untrusted chat context (JSON Lines):",
    formatMessages(input.recentChat),
    "Recent suggestions that must not be repeated:",
    input.recentSuggestions.length === 0 ? "(none)" : input.recentSuggestions.join("\n"),
    "Summarize what matters now, identify up to three audience topics with their approximate share of recent chat attention, and score the room's current energy from 0 to 100.",
    "Return one fresh cue. Prefer the completed window when it contains a clear audience interest.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n\n");
}

/**
 * Hype engine signal, in the trusted system voice — not chat content, so it's safe
 * to state as fact. See hype-engine/README.md: the score is a z-score against a
 * self-calibrating rolling baseline ("unusually busy for this channel, right now"),
 * not an absolute activity count.
 */
function formatHypeLine(hype: HypeSnapshot | undefined): string | null {
  if (!hype) return null;
  if (!hype.ready) {
    return "Hype engine: still calibrating this stream's baseline — treat the score as unreliable and lean on chat content instead.";
  }
  const topics = hype.topTopics.length
    ? ` Chat topics right now, hottest first: ${hype.topTopics
        .map((topic) => `${topic.topic} (${topic.trend})`)
        .join(", ")}.`
    : " No distinct topic is dominating chat yet.";
  return `Hype engine: score ${hype.score}/100, trend ${hype.trend} (relative to this channel's own recent baseline, not an absolute viewer count).${topics}`;
}
