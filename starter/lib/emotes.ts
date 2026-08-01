/** Kick chat encodes emotes inline as `[emote:12345:emoteName]`. */
const EMOTE_RE = /\[emote:(\d+):([^\]]*)\]/g;

export type MessageSegment =
  | { type: "text"; value: string }
  | { type: "emote"; id: string; name: string };

export function emoteImageUrl(id: string): string {
  return `https://files.kick.com/emotes/${id}/fullsize`;
}

export function parseMessage(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let last = 0;
  for (const match of content.matchAll(EMOTE_RE)) {
    if (match.index > last) {
      segments.push({ type: "text", value: content.slice(last, match.index) });
    }
    segments.push({ type: "emote", id: match[1], name: match[2] });
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    segments.push({ type: "text", value: content.slice(last) });
  }
  return segments;
}

/** Unicode emoji in plain text, for the emote wall's offline/demo mode. */
export function extractEmoji(text: string): string[] {
  return [...(text.match(/\p{Extended_Pictographic}/gu) ?? [])];
}
