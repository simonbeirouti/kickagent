/**
 * Mock chat data. Mirrors the fields of real KICK webhook payloads
 * (chat.message.sent, kicks.gifted, channel.subscription.new) per the
 * hackathon brief's "mock must reflect real data available on KICK".
 *
 * createScriptedReplay() returns a ~4.5 minute event timeline (ts offsets
 * in ms from 0) with distinct phases, built to exercise every behaviour:
 *
 *   0:00–0:50  warm-up      quiet chat about "vegas"           (baseline locks)
 *   0:50–1:40  ramp         "poker" takes over, kicks gifted   (hype climbs)
 *   1:40–2:00  spam attack  one user floods                    (score barely moves)
 *   2:00–2:50  lull         chat goes quiet, "food" whispers   (suggestion fires)
 *   2:50–3:40  Hit Me, Kick Me  streamer takes the dare, chat erupts (impact = up)
 *   3:40–4:30  cooldown     settles back toward baseline
 */

const USERS = [
  'pixel_ninja', 'og_martha', 'kebablord', 'streamsniper42', 'latte_larry',
  'nova_kat', 'dice_dan', 'quietwatcher', 'hypebeast99', 'mod_sarah',
  'clip_it_chris', 'vegasveteran', 'polly_pog', 'trucker_tim', 'zoomer_zed',
];

const BADGES = {
  og_martha: ['og'],
  mod_sarah: ['moderator'],
  hypebeast99: ['subscriber'],
  vegasveteran: ['subscriber'],
  polly_pog: ['subscriber'],
};

const LINES = {
  vegas: [
    'vegas looking crazy tonight', 'how much did this trip cost', 'vegas strip pog',
    'love the vegas vibes', 'casino lights are unreal', 'vegas W stream',
  ],
  poker: [
    'go play poker!!', 'poker table NOW', 'all in on red [emote:37226:EZ]',
    'POKER POKER POKER', 'bro knows poker trust', 'put it all on black',
    'blackjack first then poker', 'this hand is insane [emote:1730752:KEKW]',
  ],
  food: [
    'get the buffet', 'vegas buffet is elite', 'food review when',
    'try the wagyu place', 'im hungry watching this',
  ],
  hype: [
    'NO WAY [emote:1730752:KEKW]', 'LETS GOOO', 'HE ACTUALLY DID IT',
    'CLIP IT CLIP IT', 'W STREAMER W', 'IM CRYING [emote:37226:EZ]',
    'best stream of the year', 'THIS IS CINEMA',
  ],
  filler: [
    'hello everyone', 'first time here, nice stream', 'what did i miss',
    'greetings from brazil', 'sound is a bit low', 'nice one',
  ],
};

let seed = 42;
function rand() {
  // Deterministic PRNG so the demo is identical every run (stage insurance).
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

let nextId = 1;
function chat(ts, pool, user) {
  const username = user || pick(USERS);
  return {
    id: `m${nextId++}`, type: 'chat', userId: username, username,
    badges: BADGES[username] || [], text: pick(LINES[pool]), ts,
  };
}

function kicks(ts, amount) {
  const username = pick(USERS);
  return { id: `k${nextId++}`, type: 'kicks', userId: username, username, badges: BADGES[username] || [], raw: amount, ts };
}

function sub(ts) {
  const username = pick(USERS);
  return { id: `s${nextId++}`, type: 'sub', userId: username, username, badges: [], raw: 1, ts };
}

/** Poisson-ish phase filler: `rate` messages/sec from `pool` between t0 and t1. */
function phase(events, t0, t1, rate, pool, mix = {}, userPool = null) {
  for (let t = t0; t < t1; t += (0.5 + rand()) * (1000 / rate)) {
    const r = rand();
    let chosen = pool;
    for (const [otherPool, share] of Object.entries(mix)) {
      if (r < share) { chosen = otherPool; break; }
    }
    events.push(chat(Math.round(t), chosen, userPool ? pick(userPool) : undefined));
  }
}

// Real hype moments activate lurkers — high-rate phases need a wider user
// pool, or per-user saturation (correctly) treats the regulars as spammy.
const LURKERS = Array.from({ length: 60 }, (_, i) => `lurker_${i}`);

export function createScriptedReplay() {
  seed = 42;
  nextId = 1;
  const ev = [];

  // Phase 1 — warm-up: quiet, vegas talk. ~0.8 msg/s.
  phase(ev, 0, 50_000, 0.8, 'vegas', { filler: 0.35 });

  // Phase 2 — ramp: poker takes over, money arrives. ~3 msg/s.
  phase(ev, 50_000, 100_000, 3.0, 'poker', { vegas: 0.15, hype: 0.1 });
  ev.push(kicks(62_000, 50), kicks(78_000, 100), sub(85_000), kicks(95_000, 20));

  // Phase 3 — spam attack: one user, same text, 5 msg/s for 20s.
  for (let t = 100_000; t < 120_000; t += 200) {
    ev.push({
      id: `spam${nextId++}`, type: 'chat', userId: 'xX_botlord_Xx', username: 'xX_botlord_Xx',
      badges: [], text: 'FOLLOW ME FOR FREE KICKS', ts: t,
    });
  }
  phase(ev, 100_000, 120_000, 1.2, 'poker', { hype: 0.1 }); // real chat continues underneath

  // Phase 4 — lull: chat dies, food topic whispers. ~0.4 msg/s.
  phase(ev, 120_000, 170_000, 0.4, 'filler', { food: 0.45 });

  // Phase 5 — Hit Me, Kick Me: streamer takes the dare, chat erupts. ~6 msg/s,
  // mostly newly-activated lurkers.
  phase(ev, 170_000, 220_000, 6.0, 'hype', { poker: 0.2 }, [...USERS, ...LURKERS]);
  ev.push(kicks(175_000, 200), sub(180_000), sub(182_000), kicks(190_000, 500));

  // Phase 6 — cooldown. ~1.2 msg/s.
  phase(ev, 220_000, 270_000, 1.2, 'vegas', { filler: 0.3, hype: 0.15 });

  ev.sort((a, b) => a.ts - b.ts);
  return ev;
}

/**
 * Synthetic stream for scale testing: `rate` msg/s for `seconds`, with jitter.
 * A burst activates LURKERS (fresh users), the way real hype moments do —
 * that's the property spam saturation must preserve: a hundred people each
 * sending one message counts; one person sending a hundred doesn't.
 */
export function synthetic({ rate, seconds, users = 50, burst = null }) {
  const ev = [];
  let lurker = 0;
  for (let t = 0; t < seconds * 1000; t += (0.5 + rand()) * (1000 / rate)) {
    const inBurst = burst && t >= burst.atMs && t < burst.atMs + burst.forMs;
    const n = inBurst ? burst.mult : 1;
    for (let i = 0; i < n; i++) {
      const username =
        i === 0 ? `user${Math.floor(rand() * users)}` : `lurker${lurker++ % (users * 4)}`;
      ev.push({
        id: `x${nextId++}`, type: 'chat', userId: username, username, badges: [],
        text: pick(LINES.filler) + ' ' + Math.floor(rand() * 1e6), ts: Math.round(t + i * 10),
      });
    }
  }
  return ev;
}
