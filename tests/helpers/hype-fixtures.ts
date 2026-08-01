/**
 * Deterministic synthetic chat windows for the hype→suggestion path. Each
 * fixture returns rows in the exact shape the workflow's lookback query yields
 * (HypeChatRow, oldest-first) plus the `asOf` instant the engine is sampled at,
 * so tests and the validation script replay the REAL bridge — no mocks.
 */
import type { HypeChatRow } from "@/lib/hype";

export interface HypeWindowFixture {
  readonly asOf: number;
  readonly rows: HypeChatRow[];
}

const T0 = Date.parse("2026-08-01T10:00:00.000Z");

function row(
  offsetMs: number,
  index: number,
  userId: number,
  username: string,
  content: string,
): HypeChatRow {
  return {
    content,
    created_at: new Date(T0 + offsetMs).toISOString(),
    message_id: `msg-${index}-${offsetMs}`,
    sender_user_id: String(userId),
    sender_username: username,
  };
}

/**
 * ~105s of steady poker/buffet chat from a rotating crowd, then dead air.
 * Sampled 12s into the silence: baseline is locked (ready), the score has
 * cratered and is still dropping (low + falling), chat covered "poker" but
 * never "slots" — so the platform trending list leaves a gap.
 */
export function lowFallingWindow(): HypeWindowFixture {
  const rows: HypeChatRow[] = [];
  const lines = [
    (i: number) => `that poker bluff was insane ${i}`,
    (i: number) => `poker night is my favourite ${i}`,
    (i: number) => `the buffet at the casino slaps ${i}`,
    (i: number) => `imagine folding that poker hand ${i}`,
    (i: number) => `buffet review when ${i}`,
  ];
  for (let i = 0; i < 70; i++) {
    const userId = 100 + (i % 12);
    rows.push(row(i * 1_500, i, userId, `viewer_${userId}`, lines[i % lines.length]!(i)));
  }
  // Last message lands at 103.5s; the window is sampled at 117s — mid-fade.
  return { asOf: T0 + 117_000, rows };
}

/**
 * ~75s of sparse lurker chat, then a 15s burst of ~90 distinct users spamming
 * poker hype. Sampled mid-burst: the score is pinned high and climbing
 * (high + rising) and the crossing opened a highlight that is still live.
 */
export function highRisingWindow(): HypeWindowFixture {
  const rows: HypeChatRow[] = [];
  let index = 0;
  for (let i = 0; i < 38; i++, index++) {
    const userId = 200 + (i % 10);
    rows.push(
      row(i * 2_000, index, userId, `lurker_${userId}`, `just chilling tonight ${i}`),
    );
  }
  const burstStart = 75_000;
  for (let i = 0; i < 90; i++, index++) {
    const userId = 500 + i;
    rows.push(
      row(
        burstStart + Math.floor(i * (15_000 / 90)),
        index,
        userId,
        `hyped_${userId}`,
        `POKER LETS GO ${i} [emote:37226:PogChamp]`,
      ),
    );
  }
  // Sampled 9s into the burst: the score has spiked but the 12s trend window
  // still spans pre-burst samples, so the slope reads firmly "rising".
  return { asOf: T0 + 84_000, rows };
}

/**
 * Normal chat plus one user machine-gunning the same line every 400ms — the
 * engine's duplicate counter flags them as a spammer mid-window.
 */
export function spamFloodWindow(): HypeWindowFixture {
  const rows: HypeChatRow[] = [];
  let index = 0;
  for (let i = 0; i < 40; i++, index++) {
    const userId = 300 + (i % 8);
    rows.push(
      row(i * 1_500, index, userId, `regular_${userId}`, `talking about the stream ${i}`),
    );
  }
  for (let i = 0; i < 30; i++, index++) {
    rows.push(
      row(10_000 + i * 400, index, 999, "spamlord99", "FREE FOLLOWERS AT SPAM DOT COM"),
    );
  }
  rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return { asOf: T0 + 62_000, rows };
}
