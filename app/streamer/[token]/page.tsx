import type { Metadata } from "next";
import { StreamerPhoneSurface } from "@/app/_components/companion-surfaces";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Streamer Phone · Kick Streamer Companion",
};

export default async function StreamerPhonePage({
  params,
}: {
  readonly params: Promise<{ readonly token: string }>;
}) {
  const { token } = await params;
  return <StreamerPhoneSurface accessToken={token} publicMode />;
}
