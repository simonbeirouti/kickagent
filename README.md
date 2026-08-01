# Kick Streamer Companion

A multi-surface streamer companion built with Next.js, PostgreSQL, Anthropic, and Vercel Workflow. It
ingests signed Kick chat webhooks and creates a talking-point cue after five new messages or 30
seconds, whichever happens first.

Also in this repo:

- `hype-engine/` — zero-dependency hype scoring package (self-calibrating z-score, topics,
  assistant suggestions, bet impact verdicts, highlight markers). Used by this app's `/overlay`
  route and by the starter below.
- `starter/` — the kick-hype-starter demo app (17 demo pages, SSE event feed, bets economy,
  glasses HUD), now running on the shared hype engine as its scoring brain (see
  `starter/README.md`). Run it standalone: `cd starter && npm install && npm run dev`.
- `overlay/hype-meter.html` — standalone OBS-ready bar-meter widget.

The live companion surfaces are:

- `/`: authenticated overlay layout studio
- `/glasses`: private, glanceable agent summary and suggestion
- `/streamer`: phone-sized agent brief and live chat signals
- `/public/overlay`: the audience-facing 1920 × 1080 browser source

Chat, summaries, suggestions, topics, energy, and all screen layouts are backed by the connected
Kick channel and PostgreSQL. The live surfaces poll fresh server state every two seconds.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the Kick, PostgreSQL, internal auth, encryption,
   and Anthropic values.
2. Keep `KICK_STATELESS_MODE=false`; stateless mode intentionally disables ingestion and suggestions.
3. Configure the Kick OAuth callback as `https://YOUR_DOMAIN/api/auth/kick/callback` and the signed
   webhook as `https://YOUR_DOMAIN/api/kick/webhook`.
4. Apply the database schema before connecting the account.

Sign-in is open to any Kick account by default. Set `KICK_ALLOWED_USER_ID` (single numeric Kick
user id or a comma-separated list; `*`/unset allows anyone) to restrict who can connect — see
`lib/kick/access.ts`.

## Run locally

```bash
npm install
npm run db:migrate
npm run dev
```

## Stream diagnostics

Incoming Kick comments log under `[kick:chat]`, cadence decisions under `[suggestion:trigger]`, and
direct model calls under `[anthropic:suggestion]`. The logs include message and window IDs but never
prompts, chat content, API keys, or authentication tokens.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Validate the hype→Claude suggestion path without a Kick connection (replays synthetic chat through
the real hype bridge; makes one live claude-haiku call when `ANTHROPIC_API_KEY` is set in the
environment or `.env.local`, then prints the hype context and the resulting suggestion):

```bash
node scripts/validate-hype-suggestions.mjs
```

Drag the predefined widgets around the 24 × 14 snap grid, then add `/public/overlay` as a 1920 ×
1080 browser source. Public, phone, and glasses layouts are saved independently in PostgreSQL.
