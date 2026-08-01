# Kick Streamer Companion

A multi-surface streamer companion built with Next.js, eve, PostgreSQL, Anthropic, and Vercel Workflow. It
ingests signed Kick chat webhooks and creates a talking-point cue after five new messages or 30
seconds, whichever happens first.

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

## Run locally

```bash
npm install
npm run db:migrate
npm run dev:eve
```

`npm run dev` still runs plain Next.js development. Use `npm run dev:eve` while troubleshooting so
Eve session and application logs are shown together on the `APP_URL` port.

## Stream diagnostics

Incoming Kick comments log under `[kick:chat]`, cadence decisions under `[suggestion:trigger]`, and
direct model calls under `[anthropic:suggestion]`. The logs include message and window IDs but never
prompts, chat content, API keys, or authentication tokens.

```bash
npx eve logs --events
npx eve traces ls
npx eve traces <trace-id>
```

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Drag the predefined widgets around the 24 × 14 snap grid, then add `/public/overlay` as a 1920 ×
1080 browser source. Public, phone, and glasses layouts are saved independently in PostgreSQL.
