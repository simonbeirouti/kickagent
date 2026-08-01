import type { Metadata } from "next";
import { KickOverlay } from "@/app/_components/kick-overlay";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Glasses Preview · Kick Streamer Companion",
};

export default function GlassesPage() {
  return <KickOverlay liveScreen="glasses" />;
}
