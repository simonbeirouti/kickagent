"use client";

import { useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents } from "@/lib/use-kick-events";
import { emoteImageUrl, extractEmoji, parseMessage } from "@/lib/emotes";

const MAX_FLOATING = 40;
const FLOAT_MS = 6_000;

type Floater = {
  id: string;
  kind: "emoji" | "image";
  value: string; // emoji char or image URL
  name: string;
  x: number;
  drift: number;
  size: number;
  duration: number;
};

let floaterSeq = 0;

export default function EmoteWallPage() {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [seen, setSeen] = useState(0);

  function spawn(partial: Pick<Floater, "kind" | "value" | "name">) {
    const floater: Floater = {
      ...partial,
      id: `f${floaterSeq++}`,
      x: 5 + Math.random() * 90,
      drift: -40 + Math.random() * 80,
      size: 1.6 + Math.random() * 1.8,
      duration: FLOAT_MS * (0.75 + Math.random() * 0.5),
    };
    setSeen((n) => n + 1);
    setFloaters((prev) => [...prev.slice(-(MAX_FLOATING - 1)), floater]);
    setTimeout(
      () => setFloaters((prev) => prev.filter((f) => f.id !== floater.id)),
      floater.duration
    );
  }

  const { connected } = useKickEvents((e) => {
    if (e.kind !== "chat.message.sent") return;
    const content = String((e.payload as Record<string, any>)?.content ?? "");
    for (const seg of parseMessage(content)) {
      if (seg.type === "emote") {
        spawn({ kind: "image", value: emoteImageUrl(seg.id), name: seg.name });
      } else {
        for (const emoji of extractEmoji(seg.value)) {
          spawn({ kind: "emoji", value: emoji, name: emoji });
        }
      }
    }
  });

  return (
    <PageChrome
      title="Emote Wall"
      subtitle="Every emote and emoji chat sends floats up the screen — Kick's native [emote:…] syntax included. Pure vibes layer for OBS."
      connected={connected}
    >
      <section className="wall-stage">
        {floaters.length === 0 && (
          <p className="muted wall-idle">Quiet in here… inject some chat 👇</p>
        )}
        {floaters.map((f) => (
          <span
            key={f.id}
            className="wall-floater"
            style={{
              left: `${f.x}%`,
              fontSize: `${f.size}em`,
              animationDuration: `${f.duration}ms`,
              ["--drift" as string]: `${f.drift}px`,
            }}
          >
            {f.kind === "emoji" ? (
              f.value
            ) : (
              // fake emote ids 404 offline — swap the broken img for its name
              <img
                src={f.value}
                alt={f.name}
                onError={(ev) => {
                  const el = ev.currentTarget;
                  el.outerHTML = `<b class="wall-fallback">${f.name}</b>`;
                }}
              />
            )}
          </span>
        ))}
        <div className="wall-count muted">{seen} emotes this session</div>
      </section>
    </PageChrome>
  );
}
