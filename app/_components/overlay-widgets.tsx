"use client";

import {
  BellRingIcon,
  CoinsIcon,
  CrownIcon,
  FlameIcon,
  GaugeIcon,
  HandshakeIcon,
  MoveRightIcon,
  SkullIcon,
  SmilePlusIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TrophyIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  OverlayActionBet,
  OverlayPrediction,
  OverlayState,
} from "@/lib/overlay-state";

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

const PREDICTION_COLORS = ["#53fc18", "#ff6565", "#66a8ff", "#ffd23e"] as const;

export function PredictionWidget({ label = "Prediction", state }: OverlayWidgetProps) {
  const prediction = state.prediction;
  const now = useWidgetClock(
    prediction?.opensAt,
    prediction?.status === "open" || prediction?.status === "scheduled",
  );

  if (!prediction) {
    return (
      <div className="canvas-widget-inner prediction-canvas-widget">
        <WidgetHeader icon={<TrophyIcon size={17} />} label={label} />
        <p className="widget-waiting">Waiting for the next prediction…</p>
      </div>
    );
  }

  const status = effectivePredictionStatus(prediction, now);
  const opensAt = parseTimestamp(prediction.opensAt, now);
  const locksAt = parseTimestamp(prediction.locksAt, opensAt);
  const duration = Math.max(1, locksAt - opensAt);
  const progress = status === "scheduled"
    ? 0
    : status === "locked" || status === "settled"
      ? 100
      : Math.max(0, Math.min(100, ((now - opensAt) / duration) * 100));
  const winnerIds = predictionWinnerIds(prediction, status);

  return (
    <div className={`canvas-widget-inner prediction-canvas-widget status-${status}`}>
      <WidgetHeader icon={<TrophyIcon size={17} />} label={label}>
        <span className={`interaction-status ${status}`}>{predictionStatusLabel(status, opensAt, locksAt, now)}</span>
      </WidgetHeader>
      <div className="prediction-widget-content">
        <p className="prediction-widget-question">{prediction.question}</p>
        <div aria-hidden className="interaction-time-track">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="prediction-widget-options">
          {prediction.options.map((option, index) => {
            const winner = winnerIds.has(option.id);
            const muted = winnerIds.size > 0 && !winner;
            return (
              <div
                className={`prediction-widget-option${winner ? " winner" : ""}${muted ? " muted" : ""}`}
                key={option.id}
                style={{ "--option-accent": PREDICTION_COLORS[index % PREDICTION_COLORS.length] } as CSSProperties}
              >
                <i style={{ width: `${Math.max(0, Math.min(100, option.percentage))}%` }} />
                <span className="prediction-option-copy">
                  <strong>{option.label}</strong>
                  <span>{formatCompact(option.points)} pts</span>
                  <b>{option.percentage}%</b>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <footer className="widget-footer interaction-widget-footer">
        <span>Pool <strong>{formatCompact(prediction.totalPoints)} points</strong></span>
        <span>Participants <strong>{formatCompact(prediction.participantCount)}</strong></span>
      </footer>
    </div>
  );
}

export function ActionBetWidget({ label = "Action bet", state }: OverlayWidgetProps) {
  const actionBet = state.actionBet;
  const now = useWidgetClock(actionBet?.opensAt, actionBet?.status === "backing");

  if (!actionBet) {
    return (
      <div className="canvas-widget-inner action-bet-canvas-widget">
        <WidgetHeader icon={<HandshakeIcon size={17} />} label={label} />
        <p className="widget-waiting">Waiting for a viewer proposal…</p>
      </div>
    );
  }

  const status = effectiveActionBetStatus(actionBet, now);
  const opensAt = parseTimestamp(actionBet.opensAt, now);
  const locksAt = parseTimestamp(actionBet.locksAt, opensAt);
  const duration = Math.max(1, locksAt - opensAt);
  const progress = status === "backing"
    ? Math.max(0, Math.min(100, ((now - opensAt) / duration) * 100))
    : 100;

  return (
    <div className={`canvas-widget-inner action-bet-canvas-widget status-${status}`}>
      <WidgetHeader icon={<HandshakeIcon size={17} />} label={label}>
        <span className={`interaction-status ${status}`}>{actionBetStatusLabel(status, locksAt, now)}</span>
      </WidgetHeader>
      <div className="action-bet-widget-content">
        <span className="action-bet-category">{actionBet.category}</span>
        <p>{actionBet.idea}</p>
        <div aria-hidden className="interaction-time-track action-bet-time-track">
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
      <footer className="widget-footer interaction-widget-footer">
        <span>Backed by <strong>{formatCompact(actionBet.backerCount)} viewers</strong></span>
        <span><strong>{formatCompact(actionBet.totalPoints)} points</strong></span>
      </footer>
    </div>
  );
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

function useWidgetClock(fallbackValue: string | undefined, running: boolean): number {
  const fallback = fallbackValue ? parseTimestamp(fallbackValue, 0) : 0;
  const [now, setNow] = useState(fallback);

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [running]);

  return now;
}

function effectivePredictionStatus(
  prediction: OverlayPrediction,
  now: number,
): OverlayPrediction["status"] {
  if (prediction.status === "settled" || prediction.status === "locked") return prediction.status;
  const opensAt = parseTimestamp(prediction.opensAt, now);
  const locksAt = parseTimestamp(prediction.locksAt, opensAt);
  if (now >= locksAt) return "locked";
  return now < opensAt ? "scheduled" : "open";
}

function predictionWinnerIds(
  prediction: OverlayPrediction,
  status: OverlayPrediction["status"],
): ReadonlySet<string> {
  if (status !== "locked" && status !== "settled") return new Set();
  if (prediction.winnerOptionIds.length > 0) return new Set(prediction.winnerOptionIds);
  const highestPoints = Math.max(0, ...prediction.options.map((option) => option.points));
  return new Set(
    prediction.options
      .filter((option) => option.points === highestPoints)
      .map((option) => option.id),
  );
}

function predictionStatusLabel(
  status: OverlayPrediction["status"],
  opensAt: number,
  locksAt: number,
  now: number,
): string {
  if (status === "settled") return "Settled";
  if (status === "locked") return "Result";
  if (status === "scheduled") return `Opens in ${formatRemaining(opensAt - now)}`;
  return `Locks in ${formatRemaining(locksAt - now)}`;
}

function effectiveActionBetStatus(
  actionBet: OverlayActionBet,
  now: number,
): OverlayActionBet["status"] {
  if (actionBet.status !== "backing") return actionBet.status;
  return now >= parseTimestamp(actionBet.locksAt, now) ? "review" : "backing";
}

function actionBetStatusLabel(
  status: OverlayActionBet["status"],
  locksAt: number,
  now: number,
): string {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Closed";
  if (status === "review") return "Streamer review";
  return `Back for ${formatRemaining(locksAt - now)}`;
}

function parseTimestamp(value: string, fallback: number): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

// Colour bands ported from overlay/hype-meter.html: the fill blends steel
// blue → amber → kick green → white-hot as the score climbs, so the
// engagement band is readable from colour alone.
const HYPE_BAR_BANDS: readonly {
  readonly at: number;
  readonly rgb: readonly [number, number, number];
}[] = [
  { at: 0, rgb: [90, 110, 117] },
  { at: 35, rgb: [255, 176, 32] },
  { at: 70, rgb: [83, 252, 24] },
  { at: 100, rgb: [182, 255, 143] },
];

export function hypeBarColor(score: number): string {
  const value = Math.max(0, Math.min(100, score));
  const upperIndex = Math.max(1, HYPE_BAR_BANDS.findIndex((band) => value <= band.at));
  const hi = HYPE_BAR_BANDS[upperIndex];
  const lo = HYPE_BAR_BANDS[upperIndex - 1];
  const fraction = (value - lo.at) / (hi.at - lo.at);
  const channel = (index: 0 | 1 | 2) => Math.round(lo.rgb[index] + (hi.rgb[index] - lo.rgb[index]) * fraction);
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

const HYPE_BAR_TICKS = Array.from({ length: 11 }, (_, index) => index * 10);

const TREND_ICONS = {
  falling: TrendingDownIcon,
  rising: TrendingUpIcon,
  steady: MoveRightIcon,
} as const;

/**
 * Slim strip version of the hype meter, meant to sit along the top edge of a
 * screen. Same live engine fields as the hype widget (hypeScore/hypeReady/
 * hypeTrend) — never a static score in the live path; the fill and colour
 * band move with the room.
 */
export function HypeBarWidget({ label = "Hype bar", state }: OverlayWidgetProps) {
  const score = Math.max(0, Math.min(100, Math.round(state.hypeScore)));
  const status = !state.ingestionEnabled ? "Preview" : state.hypeReady ? "Live" : "Calibrating";
  const calibrating = status === "Calibrating";
  // Session peak: the notch parks at the highest score this view has seen.
  const [peak, setPeak] = useState(0);
  useEffect(() => {
    if (!calibrating) setPeak((current) => Math.max(current, score));
  }, [calibrating, score]);
  const TrendIcon = TREND_ICONS[state.hypeTrend];
  return (
    <div
      className={`canvas-widget-inner hypebar-canvas-widget${calibrating ? " calibrating" : ""}`}
      style={{
        "--bar-color": hypeBarColor(score),
        "--bar-glow": score >= 1 ? 0.25 + 0.45 * (score / 100) : 0,
        "--bar-on": score >= 1 ? 1 : 0,
        "--bar-width": `${score}%`,
      } as CSSProperties}
    >
      <span className="hypebar-title"><ZapIcon size={15} />{label}</span>
      <div aria-label={`Hype score ${score} out of 100`} className="hypebar-track">
        <span aria-hidden className="hypebar-ticks">
          {HYPE_BAR_TICKS.map((tick) => (
            <i className={tick % 50 === 0 ? "major" : undefined} key={tick} style={{ left: `${tick}%` }} />
          ))}
        </span>
        <i className="hypebar-glow" />
        <i className="hypebar-fill" />
        {peak > 0 ? <i className="hypebar-peak" style={{ left: `${peak}%` }} /> : null}
      </div>
      <span className="hypebar-readout">
        <strong>{score}</strong>
        <TrendIcon aria-label={`Hype ${state.hypeTrend}`} className={`hypebar-trend ${state.hypeTrend}`} size={15} />
      </span>
      <span className="preview-badge">{status}</span>
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
