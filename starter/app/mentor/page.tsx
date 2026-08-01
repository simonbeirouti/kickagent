"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Mirrors ../MENTOR-ACTIONS.md — keep in sync if the doc changes.

const EVENT_DAY = "2026-08-01";

const CHECKPOINTS: [time: string, label: string][] = [
  ["09:00", "Doors — get the spec, read it twice"],
  ["14:45", "FEATURE FREEZE — announce it, no exceptions"],
  ["15:15", "Full git push of a known-working state"],
  ["15:45", "Final push + email presentation & prototype to events@easygo.io"],
  ["16:00", "DISQUALIFICATION WALL — only committed code can demo"],
];

type Section = { title: string; items: string[] };

const SECTIONS: Section[] = [
  {
    title: "Hour 0 — spec drop (9:00 AM)",
    items: [
      "Read the detailed spec TWICE before anyone writes code",
      "Re-scope: what changed vs. our assumptions?",
      "Lock ONE differentiator + baseline hype meter — on paper, nothing else ships",
      "Assign the 5-min presentation an owner (suggest Anantyash) — deck starts hour 1",
      "Confirm lanes; assign the fake-event generator first",
      "Grab the KICK mentor engineers' names early",
      "Lock the Wild Card idea and builder by lunch",
    ],
  },
  {
    title: "Mid-morning",
    items: [
      "+1:30 — tracer bullet works end-to-end (webhook → overlay) or drop to fake-event fallback (mocks are sanctioned by the brief)",
      "First git push of something working — repo, remote and access verified",
      "Presentation deck skeleton exists",
    ],
  },
  {
    title: "Afternoon checkpoints",
    items: [
      "2:45 PM — announce FEATURE FREEZE, no exceptions",
      "3:15 PM — full git push of a known-working state; verify it's on the remote",
      "3:45 PM — final push + email presentation & prototype to events@easygo.io",
      "4:00 PM+ — demo rehearsal ×2 with fake events; script who says what",
      "Never demo against live-only data — fake events drive the big moment",
    ],
  },
];

const HOURLY = [
  "“Does this make the DEMO better?” — if no, cut it",
  "Is the tracer bullet (webhook → overlay) still green?",
  "Anyone stuck > 30 min → pair them or cut the feature",
  "Has everyone pushed in the last hour? Only committed code can demo",
];

const DEMO_SCRIPT = [
  "Streamer's problem (30s)",
  "Live stream on screen, team spams real chat, meter reacts (60s)",
  "Trigger the big moment (KICKs gift / threshold event)",
  "Show the differentiator",
  "“What we'd ship next” (15s) — done",
];

const GOTCHAS = [
  "OAuth host is id.kick.com, API is api.kick.com — mixed up = mystery 404s",
  "App access token covers events on ANY channel — skip user OAuth",
  "Webhook URL is per app in the dashboard, not per subscription — needs a public URL",
  "No viewer-count webhook — poll GET /public/v1/users/livestreams (~5s, cached)",
  "127.0.0.1 redirect URI is broken on Kick's side — use localhost",
  "Don't run next build while next dev is serving — clobbers .next, causes 500s",
  "Rate limits undocumented — no tight polling loops",
];

const STORAGE_KEY = "mentor-checklist-v2";

function useCountdown() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m ${s % 60}s` : `${m}m ${s % 60}s`;
}

function Countdown() {
  const now = useCountdown();
  if (!now) return null;

  const today = now.toISOString().slice(0, 10);
  const eventStart = new Date(`${EVENT_DAY}T09:00:00`);

  if (now < eventStart && today !== EVENT_DAY) {
    const days = Math.ceil((eventStart.getTime() - now.getTime()) / 86_400_000);
    return (
      <div className="mentor-banner">
        🗓️ <strong>{days} day{days === 1 ? "" : "s"}</strong> until hackathon day —
        Sat 1 Aug, 9 AM, Fortress Melbourne
      </div>
    );
  }

  const next = CHECKPOINTS.map(([time, label]) => ({
    at: new Date(`${EVENT_DAY}T${time}:00`),
    label,
  })).find((c) => c.at > now);

  if (!next) {
    return <div className="mentor-banner">🏁 Deadline passed — rehearse the demo and breathe.</div>;
  }

  const critical = next.at.getTime() - now.getTime() < 30 * 60 * 1000;
  return (
    <div className={`mentor-banner ${critical ? "mentor-banner-hot" : ""}`}>
      ⏱️ <strong>{fmt(next.at.getTime() - now.getTime())}</strong> until{" "}
      {next.label}
    </div>
  );
}

export default function MentorPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setDone(JSON.parse(saved));
    setLoaded(true);
  }, []);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const allItems = SECTIONS.flatMap((s, si) => s.items.map((_, ii) => `${si}:${ii}`));
  const doneCount = allItems.filter((id) => done[id]).length;
  const pct = Math.round((doneCount / allItems.length) * 100);

  return (
    <main className="overlay-page">
      <Link href="/" className="back-link">← starter kit</Link>
      <h1>Day-of run sheet</h1>
      <p className="muted">
        My job: timekeeper + scope-cutter. Checkboxes persist in this browser.
        Judging: product 25% · creativity 25% · technical 20% · demo/teamwork/UX 10% each —
        a sharp story about a real streamer pain beats one more feature.
      </p>

      <Countdown />

      <div className="mentor-progress">
        <div className="goal-track">
          <div className="goal-fill" style={{ width: `${pct}%` }} />
          <span className="goal-pct">{doneCount}/{allItems.length}</span>
        </div>
      </div>

      {SECTIONS.map((section, si) => {
        const sectionDone = section.items.filter((_, ii) => done[`${si}:${ii}`]).length;
        return (
          <section key={section.title}>
            <h2>
              {section.title}{" "}
              <span className="muted mentor-count">{sectionDone}/{section.items.length}</span>
            </h2>
            <ul className="mentor-list">
              {section.items.map((item, ii) => {
                const id = `${si}:${ii}`;
                return (
                  <li key={id}>
                    <label className={done[id] ? "mentor-done" : ""}>
                      <input
                        type="checkbox"
                        checked={loaded ? !!done[id] : false}
                        onChange={() => toggle(id)}
                      />
                      <span>{item}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section>
        <h2>🔁 Every hour, ask out loud</h2>
        <ul className="mentor-gotchas">
          {HOURLY.map((h) => <li key={h}>{h}</li>)}
        </ul>
      </section>

      <section>
        <h2>🎤 Demo script (10% of score, colors the rest)</h2>
        <ol className="compact-list">
          {DEMO_SCRIPT.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section>
        <h2>⚠️ Gotchas to catch fast</h2>
        <ul className="mentor-gotchas">
          {GOTCHAS.map((g) => <li key={g}>{g}</li>)}
        </ul>
      </section>

      <p className="muted">
        <button onClick={() => { localStorage.removeItem(STORAGE_KEY); setDone({}); }}>
          Reset all checkboxes
        </button>
      </p>
    </main>
  );
}
