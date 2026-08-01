import { KickOverlay } from "@/app/_components/kick-overlay";
import { createDemoOverlayState } from "@/lib/overlay-state";

export default function Page() {
  return <KickOverlay initialState={createDemoOverlayState()} />;
}
