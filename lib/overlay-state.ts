import type { OverlayLayout } from "@/lib/overlay-layout";

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
  readonly hypeReady: boolean;
  readonly hypeScore: number;
  readonly hypeTrend: "falling" | "rising" | "steady";
  readonly ingestionEnabled: boolean;
  readonly layout: OverlayLayout;
  readonly live: boolean;
  readonly messages: readonly {
    readonly content: string;
    readonly createdAt: string;
    readonly id: string;
    readonly username: string;
  }[];
  readonly suggestion: {
    readonly basis: "chat" | "stream_context" | null;
    readonly generatedAt: string;
    readonly stale: boolean;
    readonly text: string;
  } | null;
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
