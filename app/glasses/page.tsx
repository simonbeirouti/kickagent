import type { Metadata } from "next";
import { GlassesSurface } from "@/app/_components/companion-surfaces";
import { createDemoOverlayState } from "@/lib/overlay-state";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Glasses Preview · Kick Streamer Companion",
};

export default function GlassesPage() {
  return <GlassesSurface initialState={createDemoOverlayState()} />;
}
