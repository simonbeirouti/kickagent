import type { Metadata } from "next";
import { GlassesSurface } from "@/app/_components/companion-surfaces";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Glasses Preview · Kick Streamer Companion",
};

export default function GlassesPage() {
  return <GlassesSurface />;
}
