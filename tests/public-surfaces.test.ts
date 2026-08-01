import { describe, expect, it } from "vitest";
import GlassesPage from "@/app/glasses/page";
import TokenizedGlassesPage from "@/app/glasses/[token]/page";
import TokenizedOverlayPage from "@/app/overlay/[token]/page";
import StreamerPhonePage from "@/app/streamer/page";
import TokenizedStreamerPhonePage from "@/app/streamer/[token]/page";

describe("public companion surfaces", () => {
  it.each([
    ["glasses", GlassesPage],
    ["streamer", StreamerPhonePage],
  ])("renders %s in public mode", (_surface, Page) => {
    expect(Page().props.publicMode).toBe(true);
  });

  it("passes signed access tokens to every dashboard-opened live surface", async () => {
    const params = Promise.resolve({ token: "share-token" });
    const overlay = await TokenizedOverlayPage({ params });
    const glasses = await TokenizedGlassesPage({ params });
    const streamer = await TokenizedStreamerPhonePage({ params });

    expect(overlay.props).toMatchObject({ accessToken: "share-token", publicMode: true });
    expect(glasses.props).toMatchObject({
      accessToken: "share-token",
      liveScreen: "glasses",
      publicMode: true,
    });
    expect(streamer.props).toMatchObject({ accessToken: "share-token", publicMode: true });
  });
});
