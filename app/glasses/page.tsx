"use client";

import { useEffect, useState } from "react";

/**
 * Serves the glasses HUD (public/glasses/hype-glasses-hud.html) through the
 * app itself, so OBS points at a URL like http://localhost:3000/glasses
 * instead of a local file path. The HUD is still a standalone script for
 * now — see public/glasses/hype-glasses-hud.html and its sibling README for
 * the real-data wiring plan. Query params (e.g. ?transparent, ?seed=abc) are
 * forwarded straight through to the iframe.
 */
export default function GlassesPage() {
  const [src, setSrc] = useState("/glasses/hype-glasses-hud.html");

  useEffect(() => {
    setSrc(`/glasses/hype-glasses-hud.html${window.location.search}`);
  }, []);

  return (
    <iframe
      title="Glasses HUD"
      src={src}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: 0, display: "block" }}
    />
  );
}
