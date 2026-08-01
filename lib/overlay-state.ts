import { DEFAULT_OVERLAY_LAYOUT, type OverlayLayout } from "@/lib/overlay-layout";

export interface OverlayState {
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
  readonly updatedAt: string;
}

export function createDemoOverlayState(now = new Date()): OverlayState {
  const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1_000).toISOString();

  return {
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
    updatedAt: now.toISOString(),
  };
}
