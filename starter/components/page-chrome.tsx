"use client";

import Link from "next/link";
import DemoControls from "@/components/demo-controls";
import { useOverlayMode } from "@/lib/use-overlay-mode";

/** Back-link header + demo footer, both hidden in `?overlay=1` mode. */
export default function PageChrome({
  title,
  subtitle,
  connected,
  children,
}: {
  title: string;
  subtitle: string;
  connected: boolean;
  children: React.ReactNode;
}) {
  const overlay = useOverlayMode();

  return (
    <main className="overlay-page">
      {!overlay && (
        <header className="page-header">
          <Link href="/demo" className="back-link">← all demos</Link>
          <h1>{title} {connected ? "🟢" : "🔴"}</h1>
          <p className="muted">{subtitle}</p>
        </header>
      )}
      {children}
      {!overlay && (
        <footer className="page-footer">
          <DemoControls />
          <p className="muted">
            Add <code>?overlay=1</code> to this URL to hide the chrome for an OBS browser source.
          </p>
        </footer>
      )}
    </main>
  );
}
