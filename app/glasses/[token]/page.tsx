import type { Metadata } from "next";
import { KickOverlay } from "@/app/_components/kick-overlay";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Glasses Preview · Kick Streamer Companion",
};

export default async function GlassesPage({
  params,
}: {
  readonly params: Promise<{ readonly token: string }>;
}) {
  const { token } = await params;
  return <KickOverlay accessToken={token} liveScreen="glasses" publicMode />;
}
