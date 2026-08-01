# Kick Hype Starter — Design

**Date:** 2026-07-27
**Purpose:** Pre-hackathon test setup proving the full Kick API pipeline end-to-end: credentials → REST reads → webhook events → live browser feed. Deployed on Railway so the team has a working reference before the Easygo Mini Hackathon (1 Aug 2026).

## Goals

- Verify the registered Kick app (`GuiTestingApp`) credentials work.
- Display live channel data (REST) for any channel slug.
- Receive real Kick webhook events and stream them to the browser in real time.
- Serve as the architectural dry run for the hackathon "Hype Tracker" overlay.

Non-goals: user OAuth (app access token suffices), persistence (in-memory only), polished UI, hype-score logic.

## Architecture

One **Next.js (App Router)** app, deployed on **Railway** as a single persistent Node server.

```
Kick API ──webhook POST──► /api/kick/webhook ──► in-memory event bus ──► SSE /api/events/stream ──► page
    ▲                                                                                                │
    └──────────── REST (channels, subscriptions) via app access token ◄── server actions/routes ◄────┘
```

### Components

1. **Token manager** (`lib/kick-token.ts`)
   - Client credentials grant against `https://id.kick.com/oauth/token`.
   - In-memory cache; refresh when within 60s of `expires_in` expiry.
   - Server-side only. Env: `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`.

2. **Kick API client** (`lib/kick-api.ts`)
   - Thin fetch wrapper for `https://api.kick.com` with bearer token.
   - Used for: `GET /public/v1/channels?slug=`, `GET/POST/DELETE /public/v1/events/subscriptions`, `GET /public/v1/public-key`.

3. **Webhook receiver** (`app/api/kick/webhook/route.ts`)
   - Verifies `Kick-Event-Signature` (RSA PKCS1v15 + SHA-256 over `"{message_id}.{timestamp}.{raw_body}"`; public key fetched once and cached).
   - Invalid signature → 401. Valid → normalize `{type, receivedAt, payload}`, push to event bus, 200.

4. **Event bus + ring buffer** (`lib/event-bus.ts`)
   - In-memory EventEmitter + last-100-events buffer (SSE clients get backlog on connect).
   - Single-instance assumption (Railway default) — documented limitation.

5. **SSE endpoint** (`app/api/events/stream/route.ts`)
   - Streams bus events as `text/event-stream`. Heartbeat comment every 25s to keep the connection alive through proxies.

6. **UI** (`app/page.tsx` + client components)
   - Channel lookup: slug input → server fetch → card with live status, viewer count, title, category, profile picture.
   - "Watch this channel" → server route creates event subscriptions (`chat.message.sent`, `channel.followed`, `channel.subscription.new`, `channel.subscription.gifts`, `kicks.gifted`, `livestream.status.updated`) for that broadcaster.
   - Subscriptions panel: list current subscriptions, unsubscribe buttons.
   - Live feed: SSE-driven list rendering incoming events (newest first).
   - "Inject fake event" button → POSTs a synthetic event through the same bus, so the live feed is testable before Kick's webhook URL is wired up.

### Configuration & deployment

- `.env.example` committed; `.env*` gitignored.
- Railway: build from repo, set `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` as service variables, public domain enabled.
- Post-deploy manual step: set the Kick app's webhook URL to `https://<railway-domain>/api/kick/webhook`.

### Error handling

- Token fetch failure → surfaced in UI as a clear "check credentials" error.
- Kick API non-2xx → error card with status + message body.
- Signature verification failures logged (with reason), request rejected.
- SSE client disconnects cleaned up (listener removal) to avoid leaks.

### Testing

- Unit: token cache expiry logic, signature verification against a locally generated RSA keypair.
- Manual: fake-event injection end-to-end; then real webhook flow after Railway deploy (`curl` a signed request is out of scope — real Kick events serve as the integration test).

## Risks / notes

- Kick rate limits are undocumented — no polling loops in v1; all REST calls are user-initiated.
- `chat.message.sent` subscriptions capped at 1,000 for unverified apps — irrelevant at this scale.
- If Kick's webhook delivery fails >1 day, subscriptions are auto-dropped — fine for a test app; re-subscribe from the UI.
