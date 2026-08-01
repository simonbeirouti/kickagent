import { describe, expect, it } from "vitest";
import GlassesPage from "@/app/glasses/page";
import PublicOverlayPage from "@/app/public/overlay/page";
import StreamerPhonePage from "@/app/streamer/page";

describe("public companion surfaces", () => {
  it.each([
    ["glasses", GlassesPage],
    ["overlay", PublicOverlayPage],
    ["streamer", StreamerPhonePage],
  ])("renders %s in public mode", (_surface, Page) => {
    expect(Page().props.publicMode).toBe(true);
  });
});
