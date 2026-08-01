import { DEFAULT_OVERLAY_LAYOUT, type OverlayLayout } from "@/lib/overlay-layout";

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
  readonly connected: boolean;
  readonly hypeScore: number;
  readonly ingestionEnabled: boolean;
  readonly layout: OverlayLayout;
  readonly live: boolean;
  readonly messages: readonly {
    readonly content: string;
    readonly createdAt: string;
    readonly id: string;
    readonly username: string;
  }[];
  readonly prediction: {
    readonly endsInSeconds: number;
    readonly noPool: number;
    readonly question: string;
    readonly yesPercent: number;
    readonly yesPool: number;
  } | null;
  readonly privateContext?: {
    readonly headline: string;
    readonly notes: readonly string[];
  };
  readonly suggestion: {
    readonly basis: "chat" | "stream_context" | null;
    readonly generatedAt: string;
    readonly stale: boolean;
    readonly text: string;
  } | null;
  readonly surfaceContent?: {
    readonly glassesCues: readonly string[];
    readonly phoneTopics: readonly {
      readonly label: string;
      readonly percentage: number;
    }[];
    readonly viewerCount: string;
    readonly widgetLabels: {
      readonly glassesPrivate: string;
      readonly glassesSuggestion: string;
      readonly phonePulse: string;
      readonly phoneSuggestion: string;
      readonly phoneTopics: string;
      readonly publicChat: string;
      readonly publicHype: string;
      readonly publicSuggestion: string;
    };
  };
  readonly updatedAt: string;
}

export function createDemoOverlayState(now = new Date()): OverlayState {
  const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1_000).toISOString();

  return {
    activeBet: {
      amount: 50,
      payout: null,
      status: "pending",
      text: "Talk to the girls on the left",
    },
    authenticated: true,
    channel: {
      category: "Just Chatting",
      displayName: "bsimon",
      profilePicture: null,
      slug: "bsimon",
      streamTitle: "Building the future of live streaming",
    },
    connected: true,
    hypeScore: 84,
    ingestionEnabled: true,
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
      endsInSeconds: 313,
      noPool: 506,
      question: "Will you hit 13,000 trophies this stream?",
      yesPercent: 62,
      yesPool: 824,
    },
    privateContext: {
      headline: "Keep the product name private until the reveal",
      notes: [
        "Demo the glasses before the phone view",
        "Thank Mika for the raid when there is a natural pause",
      ],
    },
    suggestion: {
      basis: "chat",
      generatedAt: secondsAgo(7),
      stale: false,
      text: "Ask chat what information they would want in their glasses during a live stream.",
    },
    surfaceContent: {
      glassesCues: [
        "Ask chat what information they would want in their glasses during a live stream.",
        "Mika's message is getting traction — ask whether the glasses should feel invisible or expressive.",
        "Pause after the reveal and let chat react before moving to the phone view.",
      ],
      phoneTopics: [
        { label: "Glasses privacy", percentage: 38 },
        { label: "Phone controls", percentage: 24 },
      ],
      viewerCount: "1.8K",
      widgetLabels: {
        glassesPrivate: "Private information",
        glassesSuggestion: "Agent suggestion",
        phonePulse: "Stream pulse",
        phoneSuggestion: "Say this next",
        phoneTopics: "Chat is leaning into",
        publicChat: "Latest chat",
        publicHype: "Hype score",
        publicSuggestion: "Next talking point",
      },
    },
    updatedAt: now.toISOString(),
  };
}
