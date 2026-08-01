import type { Metadata } from "next";
import { StreamerPhoneSurface } from "@/app/_components/companion-surfaces";
import { createDemoOverlayState } from "@/lib/overlay-state";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Streamer Phone · Kick Streamer Companion",
};

export default function StreamerPhonePage() {
  return <StreamerPhoneSurface initialState={createDemoOverlayState()} />;
}
