"use client";

import Link from "next/link";
import AssistantDemoControls from "@/components/assistant/assistant-demo-controls";
import type { DemoView } from "@/lib/assistant/use-assistant";
import { useOverlayMode } from "@/lib/use-overlay-mode";

/** PageChrome variant with the assistant's own story-mode demo bar. */
export default function AssistantChrome({
  title,
  subtitle,
  connected,
  demo,
  wide,
  children,
}: {
  title: string;
  subtitle: string;
  connected: boolean;
  demo: DemoView;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const overlay = useOverlayMode();

  return (
    <main className="overlay-page" style={wide ? { maxWidth: 1400 } : undefined}>
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
          <AssistantDemoControls demo={demo} />
          <p className="muted">
            Add <code>?overlay=1</code> to this URL to hide the chrome for an OBS browser source.
          </p>
        </footer>
      )}
    </main>
  );
}
