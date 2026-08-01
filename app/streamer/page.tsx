import type { Metadata } from "next";
import { StreamerPhoneSurface } from "@/app/_components/companion-surfaces";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Streamer Phone · Kick Streamer Companion",
};

export default function StreamerPhonePage() {
  return <StreamerPhoneSurface publicMode />;
}
