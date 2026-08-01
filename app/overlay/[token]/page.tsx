import type { Metadata } from "next";
import { KickOverlay } from "@/app/_components/kick-overlay";
import { createDemoOverlayState } from "@/lib/overlay-state";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Kick Streamer Companion Overlay",
};

export default function PublicOverlayPage() {
  return <KickOverlay initialState={createDemoOverlayState()} publicMode />;
}
