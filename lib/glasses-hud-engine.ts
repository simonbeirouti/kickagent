/**
 * Self-contained demo simulation for the glasses HUD, ported from
 * hype-glasses-hud.html. Framework-agnostic: `tick()` advances the
 * simulation and returns a plain snapshot for a component to render.
 */

export type BetStatus = "locked" | "lost" | "pending" | "won";

export interface HudTopbar {
  readonly battery: number;
  readonly clock: string;
  readonly hype: number;
  readonly hypeUp: boolean;
  readonly viewers: number;
}

export interface HudFeaturedMarket {
  readonly ago: string;
  readonly ends: string;
  readonly noPct: number;
  readonly noPool: string;
  readonly question: string;
  readonly urgent: boolean;
  readonly yesPct: number;
  readonly yesPool: string;
}

export interface HudBet {
  readonly amount: string;
  readonly icon: string;
  readonly status: BetStatus;
  readonly statusText: string;
  readonly text: string;
}

export interface HudTopRow {
  readonly icon: string;
  readonly id: number;
  readonly name: string;
  readonly noPct: number;
  readonly yesPct: number;
}

export interface HudToast {
  readonly copy: string;
  readonly icon: string;
  readonly key: number;
  readonly kind: "" | "bad" | "warn";
  readonly title: string;
  readonly visible: boolean;
}

export interface HudSnapshot {
  readonly bet: HudBet | null;
  readonly featured: HudFeaturedMarket | null;
  readonly toast: HudToast | null;
  readonly topRows: readonly HudTopRow[];
  readonly topbar: HudTopbar;
  readonly totalMarkets: number;
}

export interface HudEngine {
  readonly newBet: () => void;
  readonly newMarket: () => void;
  readonly showToast: () => void;
  readonly tick: (dtSeconds: number) => HudSnapshot;
}

interface MarketRecord {
  bias: number;
  born: number;
  endsAt: number;
  icon: string;
  id: number;
  poolNo: number;
  poolYes: number;
  q: string;
  short: string;
}

interface BetRecord {
  amount: number;
  icon: string;
  payout: number | null;
  phase: number;
  text: string;
  won: boolean | null;
}

interface ToastRecord {
  copy: string;
  icon: string;
  key: number;
  kind: "" | "bad" | "warn";
  title: string;
}

const MARKETS = [
  { icon: "🏆", q: "Will you hit 13,000 trophies this stream?", short: "Hit 13K trophies?" },
  { icon: "👟", q: "Will you talk to the girls on the left?", short: "Talk to girls on left?" },
  { icon: "🎯", q: "Will you clutch the next 1v3?", short: "Clutch the 1v3?" },
  { icon: "🍜", q: "Will you finish the whole ramen bowl?", short: "Finish the ramen?" },
  { icon: "💀", q: "Will you rage quit before midnight?", short: "Rage quit by 12?" },
  { icon: "🚀", q: "Will the sub count pass 500 tonight?", short: "500 subs tonight?" },
  { icon: "🎤", q: "Will you sing the intro on stream?", short: "Sing the intro?" },
  { icon: "☕", q: "Will you make a third coffee this hour?", short: "Third coffee?" },
  { icon: "🔥", q: "Will you win 5 games in a row?", short: "5 wins in a row?" },
  { icon: "🕶️", q: "Will you keep the glasses on all stream?", short: "Glasses stay on?" },
  { icon: "🎲", q: "Will chat pick the next loadout?", short: "Chat picks loadout?" },
  { icon: "📉", q: "Will you drop below 12,400 trophies?", short: "Drop under 12.4K?" },
  { icon: "🧊", q: "Will you take the cold plunge on cam?", short: "Cold plunge on cam?" },
  { icon: "🐕", q: "Will the dog interrupt the stream again?", short: "Dog interrupts?" },
  { icon: "🎧", q: "Will you switch mics before the raid?", short: "Switch mics?" },
  { icon: "💸", q: "Will a donation over $100 land tonight?", short: "$100+ donation?" },
] as const;

const BETS = [
  { icon: "👟", t: "If you talk to the girls on the left" },
  { icon: "🔥", t: "You clutch the next round with under 20 HP" },
  { icon: "🎯", t: "Three headshots before the next death" },
  { icon: "🍜", t: "You finish the bowl without a break" },
  { icon: "🚀", t: "Sub goal cleared before the hour ends" },
  { icon: "🕶️", t: "Glasses stay on for the whole raid" },
  { icon: "🎤", t: "You take the karaoke request from chat" },
  { icon: "🧊", t: "Cold plunge happens on camera tonight" },
  { icon: "💀", t: "No deaths in the next two minutes" },
  { icon: "🎲", t: "You let chat pick the next loadout" },
] as const;

const NAMES = [
  "zeltrix", "mochi_hd", "404_notfound", "bigmoosee", "kaiju", "pixelpete",
  "vanta", "loop_", "sunnyq", "gg_marcy", "nullbyte", "tofu", "rampart", "echo9",
];

const TOASTS: readonly {
  readonly copy: (helpers: { money: (n: number) => string }) => string;
  readonly icon: string;
  readonly kind: "" | "bad" | "warn";
  readonly title: string;
}[] = [
  { copy: ({ money }) => `Chat velocity is rising. <b>+${rint(14, 68)} hype</b> in the last 10 seconds.`, icon: "⚡", kind: "", title: "HYPE ALERT" },
  { copy: ({ money }) => `<b>${pick(NAMES)}</b> just dropped <b>${money(rint(120, 900))}</b> on YES.`, icon: "💰", kind: "", title: "BIG BET" },
  { copy: () => `Betting locks in <b>${rint(20, 90)}s</b> — get your position in.`, icon: "⏳", kind: "warn", title: "MARKET CLOSING" },
  { copy: () => `YES moved <b>+${rint(4, 19)}%</b> in under a minute.`, icon: "📈", kind: "", title: "ODDS SWING" },
  { copy: () => `NO is surging — <b>${rint(21, 74)}</b> new positions taken.`, icon: "📉", kind: "bad", title: "ODDS SWING" },
  { copy: ({ money }) => `<b>${rint(12, 90)} winners</b> just split <b>${money(rint(600, 4200))}</b>.`, icon: "🎉", kind: "", title: "PAYOUT SENT" },
  { copy: () => `<b>${pick(NAMES)}</b> is raiding with <b>${rint(60, 1400)}</b> viewers.`, icon: "👀", kind: "warn", title: "RAID INCOMING" },
  { copy: () => `Agent flags this market as <b>${pick(["mispriced", "overheated", "high confidence", "coin flip"])}</b>.`, icon: "🧠", kind: "", title: "AGENT CALL" },
  { copy: () => `The <b>${rint(3, 11)}-bet</b> win streak just ended.`, icon: "⚠️", kind: "bad", title: "STREAK BROKEN" },
  { copy: ({ money }) => `<b>${pick(NAMES)}</b> entered with <b>${money(rint(1000, 5000))}</b> in play.`, icon: "🔔", kind: "", title: "NEW WHALE" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function rint(a: number, b: number): number {
  return Math.floor(rnd(a, b + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(p: number): boolean {
  return Math.random() < p;
}

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function agoText(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s ago`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m ago`;
}

function endsText(ms: number): string {
  if (ms <= 0) return "Closing…";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `Ends in ${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `Ends in ${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `Ends in ${s}s`;
}

function yesPct(m: MarketRecord): number {
  return clamp((m.poolYes / (m.poolYes + m.poolNo)) * 100, 2, 98);
}

export function createHudEngine(rows = 3): HudEngine {
  let nextId = 1;
  let elapsed = 0;
  const recentQuestions: string[] = [];
  const markets: MarketRecord[] = [];
  let featuredId: number | null = null;
  let bet: BetRecord | null = null;
  let toast: ToastRecord | null = null;
  let toastKey = 0;
  let toastVisible = false;
  let nextMarketAt = 0;
  let nextToastAt = 2_500;
  let hideToastAt = Infinity;
  let betPhaseAt = 0;
  let viewers = rint(1_800, 9_200);
  let hype = rint(30, 80);
  let hypeDelta = 1;
  let battery = rnd(72, 96);

  function makeMarket(): MarketRecord {
    let def;
    let guard = 0;
    do {
      def = pick(MARKETS);
    } while (recentQuestions.includes(def.q) && ++guard < 25);
    recentQuestions.push(def.q);
    if (recentQuestions.length > Math.min(6, MARKETS.length - 2)) recentQuestions.shift();

    const lean = rnd(0.28, 0.78);
    const seedPool = rnd(400, 2_600);
    return {
      bias: lean,
      born: elapsed,
      endsAt: elapsed + rnd(90, 460) * 1_000,
      icon: def.icon,
      id: nextId++,
      poolNo: seedPool * (1 - lean),
      poolYes: seedPool * lean,
      q: def.q,
      short: def.short,
    };
  }

  function tickMarket(m: MarketRecord, dt: number): void {
    m.bias = clamp(m.bias + rnd(-0.035, 0.035) * dt, 0.12, 0.9);
    const betCount = Math.min(4, Math.floor(rnd(0, 2.6) * dt));
    for (let i = 0; i < betCount; i++) {
      const stake = chance(0.06) ? rnd(180, 900) : rnd(8, 130);
      if (chance(m.bias)) m.poolYes += stake; else m.poolNo += stake;
    }
  }

  function feature(m: MarketRecord): void {
    featuredId = m.id;
    nextMarketAt = elapsed + rnd(14, 30) * 1_000;
  }

  function newMarketAction(): void {
    const m = makeMarket();
    markets.push(m);
    feature(m);
  }

  function newBetAction(): void {
    const def = pick(BETS);
    bet = {
      amount: chance(0.2) ? rint(10, 30) * 10 : rint(2, 15) * 10,
      icon: def.icon,
      payout: null,
      phase: 0,
      text: def.t,
      won: null,
    };
    betPhaseAt = elapsed + rnd(10, 22) * 1_000;
  }

  function advanceBet(): void {
    if (!bet) return;
    bet.phase += 1;
    if (bet.phase === 1) {
      betPhaseAt = elapsed + rnd(9, 18) * 1_000;
    } else if (bet.phase === 2) {
      const won = chance(0.58);
      const payout = won ? Math.round(bet.amount * rnd(1.4, 3.1)) : null;
      bet.won = won;
      bet.payout = payout;
      showToastAction(won
        ? { copy: `“${bet.text}” paid out <b>${money(payout ?? 0)}</b>.`, icon: "🎉", kind: "", title: "BET WON" }
        : { copy: `“${bet.text}” didn’t land. <b>${money(bet.amount)}</b> gone.`, icon: "💀", kind: "bad", title: "BET LOST" });
      betPhaseAt = elapsed + rnd(6, 11) * 1_000;
    } else {
      newBetAction();
    }
  }

  function showToastAction(custom?: { readonly copy: string; readonly icon: string; readonly kind: "" | "bad" | "warn"; readonly title: string }): void {
    const { copy, icon, kind, title } = custom ?? (() => {
      const def = pick(TOASTS);
      return { copy: def.copy({ money }), icon: def.icon, kind: def.kind, title: def.title };
    })();
    toast = { copy, icon, key: ++toastKey, kind, title };
    toastVisible = true;
    hideToastAt = elapsed + rnd(5.5, 8.5) * 1_000;
    nextToastAt = hideToastAt + rnd(4, 13) * 1_000;
  }

  function buildSnapshot(): HudSnapshot {
    const featuredMarket = markets.find((m) => m.id === featuredId) ?? null;
    const featured: HudFeaturedMarket | null = featuredMarket
      ? {
        ago: agoText(elapsed - featuredMarket.born),
        ends: endsText(featuredMarket.endsAt - elapsed),
        noPct: Math.round(100 - yesPct(featuredMarket)),
        noPool: money(featuredMarket.poolNo),
        question: featuredMarket.q,
        urgent: featuredMarket.endsAt - elapsed < 30_000,
        yesPct: Math.round(yesPct(featuredMarket)),
        yesPool: money(featuredMarket.poolYes),
      }
      : null;

    const hudBet: HudBet | null = bet
      ? {
        amount: money(bet.amount),
        icon: bet.icon,
        status: bet.phase === 0 ? "pending" : bet.phase === 1 ? "locked" : bet.won ? "won" : "lost",
        statusText: bet.phase === 0
          ? "STATUS: PENDING"
          : bet.phase === 1
            ? "STATUS: LOCKED IN"
            : bet.won
              ? `STATUS: WON  +${money(bet.payout ?? 0)}`
              : "STATUS: LOST",
        text: bet.text,
      }
      : null;

    const topRows: HudTopRow[] = [...markets]
      .sort((a, b) => b.poolYes + b.poolNo - (a.poolYes + a.poolNo))
      .slice(0, rows)
      .map((m) => ({
        icon: m.icon,
        id: m.id,
        name: m.short,
        noPct: Math.round(100 - yesPct(m)),
        yesPct: Math.round(yesPct(m)),
      }));

    return {
      bet: hudBet,
      featured,
      toast: toast ? { ...toast, visible: toastVisible } : null,
      topRows,
      topbar: {
        battery,
        clock: new Date().toLocaleTimeString([], { hour12: false }),
        hype: Math.round(hype),
        hypeUp: hypeDelta >= 0,
        viewers: Math.round(viewers),
      },
      totalMarkets: markets.length,
    };
  }

  for (let i = 0; i < rows + 2; i++) markets.push(makeMarket());
  feature(markets[0]);
  newBetAction();

  return {
    newBet: newBetAction,
    newMarket: newMarketAction,
    showToast: () => showToastAction(),
    tick(dtSeconds: number): HudSnapshot {
      const dt = Math.min(0.5, Math.max(0, dtSeconds));
      elapsed += dt * 1_000;

      for (const m of markets) tickMarket(m, dt);

      for (let i = markets.length - 1; i >= 0; i--) {
        const m = markets[i];
        if (m.endsAt < elapsed && m.id !== featuredId && markets.length > rows + 1) {
          markets.splice(i, 1);
        }
      }
      while (markets.length < rows + 2) markets.push(makeMarket());

      if (elapsed > nextMarketAt) newMarketAction();
      if (bet && elapsed > betPhaseAt) advanceBet();
      if (elapsed > nextToastAt) showToastAction();
      if (toastVisible && elapsed > hideToastAt) {
        toastVisible = false;
        hideToastAt = Infinity;
      }

      const drift = rnd(-6, 8) * dt * 10;
      viewers = clamp(viewers + drift, 400, 99_000);
      hypeDelta = rnd(-1, 1.25);
      hype = clamp(hype + hypeDelta * dt * 6, 3, 99);
      battery = clamp(battery - 0.012 * dt, 4, 100);

      return buildSnapshot();
    },
  };
}
