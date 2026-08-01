# Kick Streamer Companion

A private, streamer-only overlay built with Next.js, eve, Neon Postgres, and Vercel Workflow. It
ingests signed Kick chat webhooks and creates one short talking-point cue every 30 seconds while a
channel is live.

Also in this repo:

- `hype-engine/` — zero-dependency hype scoring package (self-calibrating z-score, topics,
  assistant suggestions, bet impact verdicts, highlight markers). Used by this app's `/overlay`
  route and by the starter below.
- `starter/` — the kick-hype-starter demo app (17 demo pages, SSE event feed, bets economy,
  glasses HUD), now running on the shared hype engine as its scoring brain (see
  `starter/README.md`). Run it standalone: `cd starter && npm install && npm run dev`.
- `overlay/hype-meter.html` — standalone OBS-ready bar-meter widget.

## Kick developer setup

1. Enable 2FA on the Kick account and create an app under
   [Kick Developer settings](https://kick.com/settings/developer).
2. Set the OAuth redirect URL to `https://YOUR_DOMAIN/api/auth/kick/callback`.
3. Enable webhooks and set the public webhook URL to
   `https://YOUR_DOMAIN/api/kick/webhook`. Kick cannot deliver webhooks to localhost.
4. The application requests only `user:read`, `channel:read`, and `events:subscribe`.

Incoming messages use Kick's `chat.message.sent` event. The Kick Chat API is not used because its
documented endpoints post and delete messages rather than read them.

## Environment

Copy `.env.example` to `.env.local` and set:

- `APP_URL`: canonical deployment origin, without a trailing slash.
- `DATABASE_URL`: Neon Postgres connection string.
- `KICK_CLIENT_ID` and `KICK_CLIENT_SECRET`: credentials from the Kick developer app.
- `TOKEN_ENCRYPTION_KEY`: at least 32 random characters; encrypts Kick access and refresh tokens.
- `EVE_INTERNAL_AUTH_SECRET`: at least 32 random characters; signs workflow-to-eve JWTs.
- `ANTHROPIC_API_KEY`: Anthropic API key used by both eve agents for direct model calls.
- `KICK_ALLOWED_USER_ID`: optional numeric allowlist for the single streamer.
- `KICK_PUBLIC_KEY`: optional override of Kick's published webhook verification key.

Use the same variables in Vercel Production. Preview deployments should use a separate Kick app if
their callback origin differs.

## Run locally

```bash
npm install
npm run db:migrate
npm run dev
```

For live webhook testing, expose port 3000 through a trusted HTTPS tunnel and temporarily use that
origin for `APP_URL`, the Kick callback, and the Kick webhook URL.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The home page is cookie-authenticated. OAuth tokens remain encrypted server-side, and the overlay
never posts to Kick chat.
