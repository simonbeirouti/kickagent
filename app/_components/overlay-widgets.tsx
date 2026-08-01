"use client";

import {
  BellRingIcon,
  CoinsIcon,
  CrownIcon,
  FlameIcon,
  GaugeIcon,
  SkullIcon,
  SmilePlusIcon,
  TargetIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { OverlayState } from "@/lib/overlay-state";

export function WidgetHeader({
  children,
  icon,
  label,
}: {
  readonly children?: ReactNode;
  readonly icon: ReactNode;
  readonly label: ReactNode;
}) {
  return (
    <header className="widget-header">
      <span className="widget-title">{icon}{label}</span>
      {children}
    </header>
  );
}

interface OverlayWidgetProps {
  readonly label?: ReactNode;
  readonly state: OverlayState;
}

export function GoalsWidget({ label = "Stream goals", state }: OverlayWidgetProps) {
  const goals = state.goals ?? [];
  return (
    <div className="canvas-widget-inner goals-canvas-widget">
      <WidgetHeader icon={<TargetIcon size={17} />} label={label}>
        <span className="count-badge">{goals.filter((goal) => goal.current >= goal.target).length}/{goals.length}</span>
      </WidgetHeader>
      <div className="goals-list">
        {goals.length === 0 ? (
          <p className="widget-waiting">Waiting for goal data…</p>
        ) : goals.map((goal) => {
          const percentage = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
          const complete = goal.current >= goal.target;
          return (
            <div className="goal-row" key={goal.key}>
              <div className="goal-label">
                <span>{goal.emoji} {goal.label}</span>
                <span className="goal-figures">{formatCompact(goal.current)} / {formatCompact(goal.target)}</span>
              </div>
              <div className="goal-track">
                <i className={complete ? "goal-fill complete" : "goal-fill"} style={{ width: `${percentage}%` }} />
                <span className="goal-percent">{percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeaderboardWidget({ label = "Top supporters", state }: OverlayWidgetProps) {
  // A gifted sub is worth 100 KICKs when ranking supporters.
  const supporters = [...(state.supporters ?? [])]
    .sort((a, b) => (b.kicks + b.giftedSubs * 100) - (a.kicks + a.giftedSubs * 100))
    .slice(0, 5);
  return (
    <div className="canvas-widget-inner board-canvas-widget">
      <WidgetHeader icon={<CrownIcon size={17} />} label={label}>
        <span className="count-badge">session</span>
      </WidgetHeader>
      <div className="board-list">
        {supporters.length === 0 ? (
          <p className="widget-waiting">No supporters yet — the throne is empty.</p>
        ) : supporters.map((supporter, index) => (
          <div className={index < 3 ? "board-row podium" : "board-row"} key={supporter.username}>
            <span className="board-rank">{["🥇", "🥈", "🥉"][index] ?? `#${index + 1}`}</span>
            <span className="board-name">{supporter.username}</span>
            <span className="board-detail">{supporterDetail(supporter.kicks, supporter.giftedSubs)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BattleWidget({ label = "Hype battle", state }: OverlayWidgetProps) {
  const battle = state.battle ?? { fire: 0, water: 0, wins: { fire: 0, water: 0 } };
  const total = battle.fire + battle.water;
  const firePercentage = total > 0 ? (battle.fire / total) * 100 : 50;
  return (
    <div className="canvas-widget-inner battle-canvas-widget">
      <WidgetHeader icon={<FlameIcon size={17} />} label={label}>
        <span className="count-badge">🔥 {battle.wins.fire} · {battle.wins.water} 💧</span>
      </WidgetHeader>
      <div className="battle-content">
        <div className="battle-track">
          <i className="battle-fill fire" style={{ width: `${firePercentage}%` }} />
          <i className="battle-fill water" style={{ width: `${100 - firePercentage}%` }} />
          <span className="battle-marker" style={{ left: `${firePercentage}%` }}>⚔️</span>
        </div>
        <div className="battle-scores">
          <span className="battle-side fire">🔥 Team Fire <strong>{battle.fire}</strong></span>
          <span className="battle-side water"><strong>{battle.water}</strong> Team Water 💧</span>
        </div>
      </div>
    </div>
  );
}

const BOSS_SPRITES = ["👹", "🐉", "👾", "🤖", "💀", "🦑"] as const;

export function BossWidget({ label = "Stream boss", state }: OverlayWidgetProps) {
  const boss = state.boss ?? { hp: 500, level: 1, maxHp: 500, topDamage: [] };
  const hpPercentage = boss.maxHp > 0 ? Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)) : 0;
  const sprite = boss.hp <= 0 ? "💥" : BOSS_SPRITES[(boss.level - 1) % BOSS_SPRITES.length];
  return (
    <div className="canvas-widget-inner boss-canvas-widget">
      <WidgetHeader icon={<SkullIcon size={17} />} label={label}>
        <span className="count-badge">Lv {boss.level}</span>
      </WidgetHeader>
      <div className="boss-content">
        <span aria-hidden className={boss.hp <= 0 ? "boss-sprite defeated" : "boss-sprite"}>{sprite}</span>
        <div className="boss-status">
          <div className="boss-hp-track">
            <i style={{ width: `${hpPercentage}%` }} />
            <span>{formatCompact(Math.max(0, boss.hp))} / {formatCompact(boss.maxHp)} HP</span>
          </div>
          {boss.topDamage.length > 0 ? (
            <p className="boss-damage">
              Top: {boss.topDamage.slice(0, 3).map((entry) => `${entry.username} −${formatCompact(entry.damage)}`).join(" · ")}
            </p>
          ) : (
            <p className="boss-damage">Chat, deal damage with follows, subs and KICKs!</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function JarWidget({ label = "Support jar", state }: OverlayWidgetProps) {
  const jar = state.jar ?? { target: 1_000, units: 0 };
  const percentage = jar.target > 0 ? Math.min(100, Math.round((jar.units / jar.target) * 100)) : 0;
  const full = jar.units >= jar.target;
  return (
    <div className="canvas-widget-inner jar-canvas-widget">
      <WidgetHeader icon={<CoinsIcon size={17} />} label={label}>
        <span className="count-badge">{percentage}%</span>
      </WidgetHeader>
      <div className="jar-content">
        <div className={full ? "jar-glass full" : "jar-glass"}>
          <i className="jar-fill" style={{ height: `${percentage}%` }} />
          <span className="jar-figures">{formatCompact(jar.units)}<small>/ {formatCompact(jar.target)}</small></span>
        </div>
        <p className="jar-caption">{full ? "JAR FULL — thank you!" : "Follows, subs and KICKs fill the jar"}</p>
      </div>
    </div>
  );
}

const ALERT_ROTATE_MS = 4_000;

export function AlertsWidget({ label = "Alerts", state }: OverlayWidgetProps) {
  const alerts = state.alerts ?? [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (alerts.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % alerts.length),
      ALERT_ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [alerts.length]);

  const alert = alerts[index % Math.max(1, alerts.length)];
  return (
    <div className="canvas-widget-inner alerts-canvas-widget">
      <WidgetHeader icon={<BellRingIcon size={17} />} label={label}>
        {alerts.length > 1 ? <span className="count-badge">+{alerts.length - 1} queued</span> : null}
      </WidgetHeader>
      <div className="alerts-content">
        {alert ? (
          <div className={`alert-card ${alert.variant}`} key={alert.id}>
            <span aria-hidden className="alert-emoji">{alert.emoji}</span>
            <div>
              <strong>{alert.headline}</strong>
              <p>{alert.detail}</p>
            </div>
          </div>
        ) : (
          <p className="widget-waiting">Waiting for the next follow, sub or gift…</p>
        )}
      </div>
    </div>
  );
}

const EMOTE_POOL = ["💚", "🔥", "😂", "🎉", "👀", "🫶", "⚡", "🤯", "👏", "🚀"] as const;
const MAX_FLOATERS = 14;

interface Floater {
  readonly duration: number;
  readonly emoji: string;
  readonly id: number;
  readonly size: number;
  readonly x: number;
}

export function EmoteWallWidget({ label = "Emote wall", state }: OverlayWidgetProps) {
  const [floaters, setFloaters] = useState<readonly Floater[]>([]);
  const sequence = useRef(0);
  const emojiPool = [...extractEmoji(state.messages.map((message) => message.content).join(" ")), ...EMOTE_POOL];
  const poolRef = useRef(emojiPool);
  poolRef.current = emojiPool;
  // Spawn faster when the room is hotter; hype 0 still trickles so the widget never looks dead.
  const spawnMs = Math.max(450, 2_200 - state.hypeScore * 18);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const pool = poolRef.current;
      const floater: Floater = {
        duration: 4.5 + Math.random() * 3.5,
        emoji: pool[Math.floor(Math.random() * pool.length)],
        id: sequence.current += 1,
        size: 1.2 + Math.random() * 1.4,
        x: 5 + Math.random() * 90,
      };
      setFloaters((current) => [...current.slice(-MAX_FLOATERS + 1), floater]);
      window.setTimeout(
        () => setFloaters((current) => current.filter((item) => item.id !== floater.id)),
        floater.duration * 1_000,
      );
    }, spawnMs);
    return () => window.clearInterval(timer);
  }, [spawnMs]);

  return (
    <div className="canvas-widget-inner wall-canvas-widget">
      <WidgetHeader icon={<SmilePlusIcon size={17} />} label={label} />
      <div aria-hidden className="wall-stage">
        {floaters.map((floater) => (
          <span
            className="wall-floater"
            key={floater.id}
            style={{
              animationDuration: `${floater.duration}s`,
              fontSize: `${floater.size}em`,
              left: `${floater.x}%`,
            } as CSSProperties}
          >
            {floater.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PulseWidget({ label = "Chat pulse", state }: OverlayWidgetProps) {
  const bars = velocityBars(state.hypeScore, state.messages.length);
  const words = trendingWords(state.messages.map((message) => message.content));
  return (
    <div className="canvas-widget-inner pulse-canvas-widget">
      <WidgetHeader icon={<GaugeIcon size={17} />} label={label}>
        <span className="count-badge">{Math.max(1, Math.round(state.hypeScore / 6))} msg/min</span>
      </WidgetHeader>
      <div className="pulse-content">
        <div aria-hidden className="pulse-bars">
          {bars.map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className="pulse-words">
          {words.length === 0 ? (
            <span className="widget-waiting">Listening to chat…</span>
          ) : words.map((word) => <span className="pulse-word" key={word}>{word}</span>)}
        </div>
      </div>
    </div>
  );
}

function supporterDetail(kicks: number, giftedSubs: number): string {
  const parts: string[] = [];
  if (kicks > 0) parts.push(`${formatCompact(kicks)} KICKs`);
  if (giftedSubs > 0) parts.push(`${giftedSubs} gift sub${giftedSubs === 1 ? "" : "s"}`);
  return parts.join(" · ") || "supporter";
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 1, notation: "compact" }).format(value);
}

function extractEmoji(text: string): string[] {
  return text.match(/\p{Extended_Pictographic}/gu) ?? [];
}

const PULSE_PATTERN = [0.55, 0.8, 0.63, 1, 0.72, 0.92, 0.68, 0.58, 0.76, 0.96, 0.61, 0.84, 0.7, 0.88] as const;

function velocityBars(hypeScore: number, messageCount: number): number[] {
  const floor = Math.max(8, Math.round(hypeScore * 0.3) + messageCount * 2);
  return PULSE_PATTERN.map((factor) =>
    Math.min(100, Math.max(6, Math.round(floor + hypeScore * factor * 0.6))),
  );
}

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "this", "with", "you", "your", "was", "are",
  "but", "not", "can", "about", "what", "just", "have", "like", "its", "it's",
]);

function trendingWords(contents: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    for (const raw of content.toLowerCase().split(/\s+/)) {
      const word = raw.replace(/[^\p{L}\p{N}!?]/gu, "");
      if (word.length < 3 || STOP_WORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}
