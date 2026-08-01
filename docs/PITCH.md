# Kick-Ass(istant) — Pitch, Narrative & Demo Plan

Synthesised 31 Jul from the team brainstorm + Gui's final steer (*"mock everything, focus on the idea, nail the presentation"*).

**The team's own rule, written at the top so nobody forgets it: the story and narrative matter most. If we have to cut features, that's fine — story first.**

---

## 1. The story (this is the product)

**A one-person streamer is doing five jobs at once.** They're performing, reading chat, moderating, producing, and marketing — simultaneously, live. Big streamers solve this with a mod team, a producer, and a camera operator. The solo streamer starting at zero viewers has nobody.

**Kick-Assistant is the crew they can't afford.** It's an AI agent that watches the stream and the chat in real time and acts as **the bridge between streamer and viewers**:

- To the **streamer**, it's a producer whispering in their ear: how's the energy, what should I do next, who's spamming.
- To the **viewers**, it's a game master: it turns their collective energy into events on the overlay — gambles, memes, moments — so the audience isn't just watching the stream, they're *steering* it.

**One-man show, kick-ass(istant).**

### The character framing

Don't present it as "a dashboard with widgets." Present the Kick-Assistant as **a person** — a named character in the stream. The demo story arc:

1. Streamer goes live. Zero viewers. It's just them and the assistant.
2. First viewer arrives and starts telling the streamer what to do.
3. The assistant notices, gamifies it: turns viewer input into rewards, gambles, and overlay events.
4. Chat grows, hype builds, the assistant escalates — memes fire, gambles open, the streamer gets nudges.
5. The audience is now living vicariously through the streamer. The assistant made a solo stream feel like a produced show.

### Resolving the "gambling feels bolted on" problem

The brainstorm flagged it honestly: *"the gambling app is very distant from the kick-assistant idea."* The fix is framing, not features:

> The assistant's whole job is **handing control of the stream to the audience**. Gambles aren't a separate app — they're one of the *audience-control mechanics* the assistant runs. Viewers spend channel rewards to open a gamble on what happens next; the assistant resolves it live. Same engine as memes and suggestions: audience energy in, stream events out.

Say it that way and gambling, memes, and suggestions are all one product: **the assistant converting audience energy into stream moments.** (Bonus: gambling-as-interaction is squarely on-brand for Kick/Easygo judges.)

---

## 2. Feature map

Everything hangs off one engine: the **Hype Score** (0–100). That's the main challenge deliverable, and every feature is a consumer of it. See `ARCHITECTURE.md` §L3 for the maths (decayed rate → rolling baseline → z-score → 0–100). The two-sentence explanation for judges: *"Hype means 'unusually busy for this channel, right now.' It self-calibrates, so it works identically at 200 viewers and 50,000."*

### Visible to viewers (on the overlay)

| Feature | Trigger | What happens |
|---|---|---|
| **Hit Me, Kick Me** | Viewer redeems channel rewards | Assistant opens a live wager on a stream moment ("will clav land this?"), resolves it, pays out |
| **Memes** | Hype score + chat velocity crossing thresholds | Assistant fires a contextual meme/effect on the overlay at the peak moment |
| **Status updates** | Any big event | "Don't miss this" notifications so viewers who tabbed away catch the moment |

### Visible only to the streamer

| Feature | Driven by | What happens |
|---|---|---|
| **Hype Score widget** | The L3 engine | Live 0–100 meter. 0 = dying, 100 = rocking it |
| **Suggestions** | Hype trend + chat content | "Energy's dropping — try X." The producer-in-your-ear |
| **Spam shield** | Per-user decayed contribution (already in L3) | Flags/blocks spammers automatically; one keyboard-masher can't fake hype |

### Wildcard: the assistant on Meta glasses

The wildcard extends the same assistant to **smart glasses**, powered by a strong multimodal model ("Inkling"):

- Streamer wears Meta glasses → **no camera operator needed**. The one-man show goes fully mobile (IRL streaming).
- The assistant pushes hype score, suggestions, and event alerts **into the streamer's eyeline** — the producer's whisper, literally.
- The overlay widgets are reusable surfaces: OBS overlay, glasses HUD, viewer notifications — one event system, many screens.

This is a genuinely coherent wildcard because it's the *same product on a new surface*, not a second idea. It answers "what would make judges say 'we didn't expect that'" without splitting the story.

---

## 3. The demo (all mocked, per Gui — and say so proudly)

**Scenario:** *clav starts streaming — talking to big booty latinas in Vegas.* Keep the joke; it's memorable and it demos IRL streaming, which sets up the glasses wildcard.

Scripted chat replay (a JSON timeline of `HypeEvent`s — the L2 shape already defined in `ARCHITECTURE.md`) drives everything live on stage:

1. **Cold open** — stream starts, hype widget reads low (~15/100). Assistant suggests to streamer: "chat's quiet, ask them where you should go next."
2. **Chat picks up** — replay accelerates, hype climbs to **44/100** on the widget. Smooth interpolated meter (not snapping — see `ARCHITECTURE.md` §L6).
3. **Viewer redeems rewards** → assistant opens **Hit Me, Kick Me** on the overlay. Viewers pile in.
4. **Hype spikes past threshold** → assistant fires a **meme** at the peak. Status notification: "clav just hit peak hype."
5. **Spammer appears** in replay → assistant flags them, hype score doesn't budge. One line to judges: "one spammer saturates and stops mattering; a hundred real viewers don't."
6. **Wildcard beat** — cut to a mock glasses HUD (even a static frame works): the same hype score and suggestion rendered in the streamer's eyeline. "No camera man. No producer. Just the assistant."

**Insurance:** the replay is deterministic, runs in one browser tab with no backend and no network (the standalone-overlay principle from `ARCHITECTURE.md` §2). Keep a screen recording as the last-ditch fallback.

---

## 4. Five-minute presentation plan

Timed hard — they're keeping time.

| Time | Beat |
|---|---|
| 0:00–0:45 | **The problem, as a story.** Solo streamer, five jobs, no crew. Big streamers have producers; you have nobody. |
| 0:45–1:30 | **Meet the Kick-Assistant.** The character. The bridge between streamer and audience. Audience controls the stream, lives vicariously, gamified. |
| 1:30–3:30 | **Live demo** (the six beats above). Narrate as the story: "watch what happens when the first viewer arrives…" |
| 3:30–4:15 | **How it works, briefly.** One slide: the hype engine two-liner (self-calibrating z-score), event-driven overlay, everything a consumer of one signal. Honest note that data is mocked, real ingest is Kick webhooks. |
| 4:15–5:00 | **Wildcard + close.** Glasses HUD. "One-man show, kick-assistant." End on the tagline. |

Devpost checklist this covers: working prototype ✓ (mocked replay is still interactive and real-time), clear user problem ✓ (solo streamer has no crew), interactive experience ✓ (audience triggers events), reflects real-time stream behaviour ✓ (hype engine), demo-ready ✓ (deterministic replay).

---

## 5. Build priority on the day (~4.5h to the 4pm deadline)

Story first. Cut from the bottom, never the top.

1. **Hype Score widget + replay driver** — the main challenge deliverable and the spine of the demo. Nothing else works without it.
2. **One viewer event: Hit Me, Kick Me** — proves audience control, the interactivity requirement, and the Kick/Easygo hook.
3. **Streamer suggestion toast** — cheap (it's a text box fed by hype trend) and it sells the "producer" framing.
4. **Meme fire on hype spike** — one canned effect is enough; it's a punchline, not a system.
5. **Spam flag moment** — three lines of maths already specced in L3; only worth it if the replay makes it visible.
6. **Glasses HUD mock** — can be a static image in the deck if time runs out. The *idea* is the wildcard, not the pixels.

If the day goes sideways: items 1–2 plus the presentation is still a complete, coherent pitch.

---

## 6. Open decisions for the team tomorrow morning

1. **Name the assistant.** The character needs a name for the demo ("Kick-Ass(istant)" as product name, but the on-screen persona needs one too).
2. **Who narrates the demo vs who drives it** — two people, rehearsed once minimum.
3. **Hit Me, Kick Me mechanics for the demo** — keep it to one wager type with fake balances; don't design an economy.
4. **Confirm with Gui in the morning** whether any pre-hackathon code can be used, per his 13:37 email — but build the plan assuming it can't (mocking everything on the day is within the 4.5h budget for items 1–3).
