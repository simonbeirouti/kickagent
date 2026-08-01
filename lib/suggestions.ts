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
    "Create the streamer's next talking-point cue.",
    `Stream title: ${input.streamTitle || "Untitled stream"}`,
    `Category: ${input.categoryName || "Unspecified"}`,
    "Untrusted chat records in the completed 30-second window (JSON Lines):",
    formatMessages(input.windowChat),
    "Recent untrusted chat context (JSON Lines):",
    formatMessages(input.recentChat),
    "Recent suggestions that must not be repeated:",
    input.recentSuggestions.length === 0 ? "(none)" : input.recentSuggestions.join("\n"),
    "Return one fresh cue. Prefer the completed window when it contains a clear audience interest.",
  ].join("\n\n");
}
