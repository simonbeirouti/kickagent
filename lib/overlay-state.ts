import {
  DEFAULT_OVERLAY_LAYOUT,
  type OverlayLayout,
  type ScreenLayouts,
} from "@/lib/overlay-layout";

export interface OverlayAlert {
  readonly detail: string;
  readonly emoji: string;
  readonly headline: string;
  readonly id: string;
  readonly variant: "follow" | "gift" | "kicks" | "live" | "sub";
}

export interface OverlayGoal {
  readonly current: number;
  readonly emoji: string;
  readonly key: "follows" | "kicks" | "subs";
  readonly label: string;
  readonly target: number;
}

export interface OverlaySupporter {
  readonly giftedSubs: number;
  readonly kicks: number;
  readonly username: string;
}

export interface OverlayPredictionOption {
  readonly id: string;
  readonly label: string;
  readonly percentage: number;
  readonly points: number;
}

export interface OverlayPrediction {
  readonly id: string;
  readonly locksAt: string;
  readonly opensAt: string;
  readonly options: readonly OverlayPredictionOption[];
  readonly participantCount: number;
  readonly question: string;
  readonly status: "locked" | "open" | "scheduled" | "settled";
  readonly totalPoints: number;
  readonly winnerOptionIds: readonly string[];
}

export interface OverlayActionBet {
  readonly backerCount: number;
  readonly category: string;
  readonly id: string;
  readonly idea: string;
  readonly locksAt: string;
  readonly opensAt: string;
  readonly status: "accepted" | "backing" | "rejected" | "review";
  readonly totalPoints: number;
}

export interface OverlayState {
  readonly activeBet: {
    readonly amount: number;
    readonly payout: number | null;
    readonly status: "pending" | "locked" | "won" | "lost";
    readonly text: string;
  } | null;
  readonly authenticated: true;
  readonly channel: {
    readonly category: string | null;
    readonly displayName: string;
    readonly profilePicture: string | null;
    readonly slug: string;
    readonly streamTitle: string | null;
  };
  readonly actionBet: OverlayActionBet | null;
  readonly alerts?: readonly OverlayAlert[];
  readonly battle?: {
    readonly fire: number;
    readonly water: number;
    readonly wins: { readonly fire: number; readonly water: number };
  };
  readonly boss?: {
    readonly hp: number;
    readonly level: number;
    readonly maxHp: number;
    readonly topDamage: readonly { readonly damage: number; readonly username: string }[];
  };
  readonly connected: boolean;
  readonly goals?: readonly OverlayGoal[];
  readonly hypeReady: boolean;
  readonly hypeScore: number;
  readonly hypeTrend: "falling" | "rising" | "steady";
  readonly jar?: { readonly target: number; readonly units: number };
  readonly ingestionEnabled: boolean;
  readonly layout: OverlayLayout;
  readonly live: boolean;
  readonly messages: readonly {
    readonly content: string;
    readonly createdAt: string;
    readonly id: string;
    readonly username: string;
  }[];
  readonly prediction: OverlayPrediction | null;
  readonly privateContext?: {
    readonly headline: string;
    readonly notes: readonly string[];
  };
  readonly screenLayouts: ScreenLayouts;
  readonly suggestion: {
    readonly basis: "chat" | "stream_context" | null;
    readonly generatedAt: string;
    readonly stale: boolean;
    readonly text: string;
  } | null;
  readonly supporters?: readonly OverlaySupporter[];
  readonly summary: {
    readonly generatedAt: string;
    readonly stale: boolean;
    readonly text: string;
    readonly topics: readonly {
      readonly label: string;
      readonly percentage: number;
    }[];
  } | null;
  readonly updatedAt: string;
}

export function createDemoOverlayState(now = new Date()): OverlayState {
  const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1_000).toISOString();
  const secondsFromNow = (seconds: number) => new Date(now.getTime() + seconds * 1_000).toISOString();

  return {
    activeBet: {
      amount: 50,
      payout: null,
      status: "pending",
      text: "Talk to the girls on the left",
    },
    actionBet: {
      backerCount: 9,
      category: "Performance",
      id: "demo-action-bet",
      idea: "Play the next round using a random character",
      locksAt: secondsFromNow(42),
      opensAt: secondsAgo(18),
      status: "backing",
      totalPoints: 850,
    },
    alerts: [
      { detail: "just followed the channel", emoji: "💚", headline: "pixelpilot", id: "demo-alert-1", variant: "follow" },
      { detail: "subscribed · 3 months strong", emoji: "⭐", headline: "mika_live", id: "demo-alert-2", variant: "sub" },
      { detail: "sent 200 KICKs — “let’s gooo”", emoji: "🪙", headline: "devon", id: "demo-alert-3", variant: "kicks" },
      { detail: "gifted 5 subs to the community", emoji: "🎁", headline: "nova_rae", id: "demo-alert-4", variant: "gift" },
    ],
    authenticated: true,
    battle: { fire: 62, water: 38, wins: { fire: 2, water: 1 } },
    boss: {
      hp: 340,
      level: 3,
      maxHp: 1125,
      topDamage: [
        { damage: 420, username: "devon" },
        { damage: 260, username: "pixelpilot" },
        { damage: 105, username: "mika_live" },
      ],
    },
    channel: {
      category: "Just Chatting",
      displayName: "bsimon",
      profilePicture: null,
      slug: "bsimon",
      streamTitle: "Building the future of live streaming",
    },
    connected: true,
    goals: [
      { current: 7, emoji: "💚", key: "follows", label: "New follows", target: 10 },
      { current: 5, emoji: "⭐", key: "subs", label: "New subs", target: 5 },
      { current: 320, emoji: "🪙", key: "kicks", label: "KICKs gifted", target: 500 },
    ],
    hypeReady: true,
    hypeScore: 84,
    hypeTrend: "rising",
    ingestionEnabled: false,
    jar: { target: 1_000, units: 640 },
    layout: DEFAULT_OVERLAY_LAYOUT,
    live: true,
    messages: [
      {
        content: "Ask about the first stream you ever watched",
        createdAt: secondsAgo(42),
        id: "demo-message-1",
        username: "pixelpilot",
      },
      {
        content: "The glasses idea is actually wild",
        createdAt: secondsAgo(28),
        id: "demo-message-2",
        username: "mika_live",
      },
      {
        content: "Can we see the phone view next?",
        createdAt: secondsAgo(11),
        id: "demo-message-3",
        username: "devon",
      },
    ],
    prediction: {
      id: "demo-prediction",
      locksAt: secondsFromNow(6),
      opensAt: secondsAgo(4),
      options: [
        { id: "yes", label: "Yes", percentage: 29, points: 200 },
        { id: "no", label: "No", percentage: 71, points: 500 },
      ],
      participantCount: 14,
      question: "Will Neon hit 13,000 trophies this stream?",
      status: "open",
      totalPoints: 700,
      winnerOptionIds: [],
    },
    privateContext: {
      headline: "Keep the product name private until the reveal",
      notes: [
        "Demo the glasses before the phone view",
        "Thank Mika for the raid when there is a natural pause",
      ],
    },
    screenLayouts: { public: DEFAULT_OVERLAY_LAYOUT },
    suggestion: {
      basis: "chat",
      generatedAt: secondsAgo(7),
      stale: false,
      text: "Ask chat what information they would want in their glasses during a live stream.",
    },
    supporters: [
      { giftedSubs: 5, kicks: 200, username: "nova_rae" },
      { giftedSubs: 0, kicks: 420, username: "devon" },
      { giftedSubs: 2, kicks: 60, username: "pixelpilot" },
      { giftedSubs: 0, kicks: 150, username: "mika_live" },
      { giftedSubs: 1, kicks: 0, username: "glitchcraft" },
    ],
    summary: {
      generatedAt: secondsAgo(12),
      stale: false,
      text: "Chat is excited about private, glanceable stream controls and wants to see the phone view next.",
      topics: [
        { label: "Glasses privacy", percentage: 62 },
        { label: "Phone controls", percentage: 38 },
      ],
    },
    updatedAt: now.toISOString(),
  };
}
