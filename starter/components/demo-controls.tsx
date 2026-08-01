"use client";

const BUTTONS: [label: string, type: string][] = [
  ["💬 chat", "chat.message.sent"],
  ["➕ follow", "channel.followed"],
  ["⭐ sub", "channel.subscription.new"],
  ["🎁 gift subs", "channel.subscription.gifts"],
  ["🚀 kicks", "kicks.gifted"],
];

async function inject(body: Record<string, unknown>) {
  await fetch("/api/fake-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Shared fake-event injector bar so every overlay page is demoable offline. */
export default function DemoControls() {
  return (
    <div className="demo-bar">
      <span className="muted">Inject fake:</span>
      {BUTTONS.map(([label, type]) => (
        <button key={type} onClick={() => inject({ type })}>{label}</button>
      ))}
      <button className="primary" onClick={() => inject({ burst: 18 })}>
        🔥 hype burst
      </button>
    </div>
  );
}
