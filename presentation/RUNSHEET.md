# Presentation Run Sheet — Team 6 (Kick-Ass(istant))

## Format
- **5 min pitch** (they keep time — hard stop) + **4 min judges' questions** + 1 min changeover
- The demo is a **60-second RECORDED video** embedded at slide 5 — nothing is driven live during the pitch.
  Keep the live surfaces open in background tabs anyway: they're gold for the Q&A ("want to see it on real chat right now?").
- Presenter: **@who? — DECIDE BEFORE RECORDING THE VOICEOVER**

## Deadlines (note the discrepancy!)
- Printed brief says code pushed + email by **4:00pm**
- Team doc says email final proposal to events@easygo.io by **3:45pm**
- **Plan for 3:45pm.** Video exported, deck emailed, code pushed, by 3:40.

## Slide-by-slide timing (sums to 5:00 — rehearse with the built-in timer, press T; HUD shows "leave by")
| # | Slide | Beat | Window |
|---|---|---|---|
| 1 | Title | tagline, built today, proven today | 0:00–0:15 |
| 2 | The Challenge | make hype visible | 0:15–0:30 |
| 3 | The Problem | solo streamer, five jobs, no crew | 0:30–0:45 |
| 4 | Meet the Kick-Assistant | viewers see / streamer sees — one engine | 0:45–1:30 |
| 5 | **Recorded demo** | 60-s video plays; presenter stays quiet | 1:30–2:30 |
| 6 | How it works | z-score two-liner, spam shield, honest mocking note | 2:30–3:00 |
| 7 | Proven on real data | n3on/xqc numbers, zero false flags, 79+10 checks | 3:00–3:30 |
| 8 | Wildcard | glasses HUD is real; dare resolved "up, Δ+17" | 3:30–4:15 |
| 9 | Judging criteria | say the criteria words out loud | 4:15–4:45 |
| 10 | Close | "One-man show, kick-ass(istant)." | 4:45–5:00 |

Check: 15+15+15+45+60+30+30+45+30+15 = 300 s = **5:00 exactly**.

## 60-second demo recording script (produces `presentation/demo-60s.mp4`)

### Prep (do this ~10 min before recording)
1. Serve everything from the **kickagent repo** (its server also routes the glasses HUD):
   ```bash
   cd "/Users/single0_0bit/Claude Sandbox/easygo_minihackathon/kickagent" && /opt/homebrew/bin/node hype-engine/serve.js
   ```
2. Open **4 browser tabs**, in this order:
   - **T1 — overlay widget** (self-contained, no server needed): open the file
     `kickagent/overlay/hype-meter.html` directly in the browser. Hotkeys: **K** kicks burst, **S** spammer.
   - **T2 — scripted dashboard**: `http://localhost:8420/demo/` → click **Speed 1×** once (→ **2×**) → click **Restart** → wait ~25 s until the badge reads **"BASELINE LOCKED — HIT ME, KICK ME OPEN"**. Record only after this.
   - **T3 — live mode**: `http://localhost:8420/demo/?source=live` → confirm the LIVE badge and events flowing (needs a subscribed channel currently live). Open ≥1 min early so baseline/topics build.
   - **T4 — glasses HUD live**: `http://localhost:8420/glasses/hype-glasses-hud.html?source=live` → open ≥1 min early (real-time baseline lock takes ~45 s; panels populate themselves).
3. Recording: full-screen browser, bookmarks bar hidden, 1080p+, cursor visible (judges should see the clicks). QuickTime or OBS. Record the voiceover with the take, or dub after.
4. **Fallback** — if no subscribed channel is live at recording time: cut shot 5, stretch shots 2–4 by ~3 s each, and let slide 7 carry the real-data proof.

### Shots — 60 seconds total
| Shot | Time | Tab · action | On screen | Voiceover |
|---|---|---|---|---|
| 1 | 0:00–0:08 | **T1** · press **K** | Bar meter surges: glow, embers, biggest-call card, session-peak notch | "This is the hype meter — stream energy, made visible, OBS-ready. A kicks gift lands… and the room lights up." |
| 2 | 0:08–0:18 | **T2** · click **Inject hype burst** | Meter climbs; **Highlights Recap** captures a clip marker | "Behind it, the assistant. Chat pops off — and it drops a clip marker automatically. Your highlight reel builds itself." |
| 3 | 0:18–0:28 | **T2** · click **Inject spammer** | Spam flag appears in the assistant feed; score barely moves | "A spam flood hits. Flagged in a second — and the score doesn't care. A fast-typing fan can't be flagged; a spammer can't fake hype." |
| 4 | 0:28–0:40 | **T2** · click **Hit Me, Kick Me** | "measuring hype impact for 15s…" toast → verdict toast **HYPE UP** with Δ | "A viewer dares the streamer. The assistant measures the impact and calls it — hype UP. Bets resolve on measured energy, not vibes." |
| 5 | 0:40–0:50 | switch to **T3** | LIVE badge, real chat topics ticking | "Everything so far was our scripted replay — stage insurance. This is the same engine on real KICK chat, right now. Those topics are what the stream is actually about." |
| 6 | 0:50–1:00 | switch to **T4** | Glasses HUD: hype ring, prediction card, dare, leaderboard | "And the wildcard — the whole assistant in the streamer's eyeline. No producer, no crew. One-man show… kick-ass(istant)." |

Notes:
- Shot 4: at Speed 2× the 15-s impact window resolves in ~7.5 s of real time — the verdict lands inside the shot.
- Do one full rehearsal take first; the buttons are deterministic, so take 2 will match take 1.
- Export 1920×1080 MP4 → save as **`presentation/demo-60s.mp4`** (slide 5 plays exactly this path; **V** = play/pause in the deck).

## Submission checklist
- [ ] `demo-60s.mp4` exported into `presentation/` and playing on slide 5 (press V to check)
- [ ] Deck rehearsed **under 5:00** with the built-in timer (T) — watch the "leave by" chip
- [ ] Code pushed: `kickagent` branch `anantyash/hype-engine` (engine + surfaces + presentation/)
- [ ] Email presentation + prototype to **events@easygo.io by 3:45pm** — attach the deck (and video file), link the repo + branch
- [ ] Working prototype built during the hackathon ✓ · interactive ✓ · real-time ✓ · wildcard ✓ — all true, tick when emailed

## Rules of thumb
- The video does the demo talking — the presenter breathes during slide 5 and picks back up at 2:30.
- Story first (the team's own rule). The tech slides exist to back the story, not replace it.
- Have fun with it.

## Deck TODOs (marked red in the deck)
- [ ] Presenter name (slide 1)
- [ ] `demo-60s.mp4` recording dropped into `presentation/` (slide 5)
- [ ] Optional glasses HUD screenshot (slide 8)
- [ ] Who-built-what for the teamwork criterion (slide 9)
- [ ] Team member names (slide 10)
