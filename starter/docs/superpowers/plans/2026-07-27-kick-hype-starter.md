# Kick Hype Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js app on Railway that proves the full Kick API pipeline: app-token REST reads, webhook ingestion with RSA signature verification, and a live SSE event feed in the browser.

**Architecture:** One Next.js (App Router) server. Server-side libs handle token caching, Kick REST calls, signature verification, and an in-memory event bus. Route handlers expose webhook ingestion, SSE streaming, and thin JSON APIs consumed by three small client components.

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, Vitest 3, Node 20+, no database.

## Global Constraints

- Secrets (`KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`) are read only in server-side code; never prefix with `NEXT_PUBLIC_`, never send to the client.
- Kick hosts: OAuth = `https://id.kick.com`, API = `https://api.kick.com` (spec: do not mix them up).
- No background polling loops — all Kick REST calls are user-initiated (rate limits are undocumented).
- In-memory state only; single-instance assumption (Railway default).
- All imports use the `@/` path alias (maps to repo root).
- Test runner: `npx vitest run <file>` (or `npm test` for all).
- Repo root for all paths below: `kick-hype-starter/`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a building Next.js app; `@/` alias available to all later tasks; `npm test` wired to vitest.

- [ ] **Step 1: Write config and scaffold files**

`package.json`:

```json
{
  "name": "kick-hype-starter",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.5.0",
    "vitest": "^3.0.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

`.gitignore`:

```
node_modules/
.next/
.env*
!.env.example
*.tsbuildinfo
next-env.d.ts
```

`.env.example`:

```
# From https://kick.com/settings/developer (account needs 2FA enabled)
KICK_CLIENT_ID=your_client_id_here
KICK_CLIENT_SECRET=your_client_secret_here
```

`app/layout.tsx`:

```tsx
import "./globals.css";

export const metadata = { title: "Kick Hype Starter" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx` (placeholder, replaced in Task 9):

```tsx
export default function Home() {
  return <main><h1>Kick Hype Starter</h1></main>;
}
```

`app/globals.css`:

```css
:root {
  color-scheme: dark;
  --bg: #0f1115;
  --panel: #1a1e26;
  --border: #2c323e;
  --accent: #53fc18; /* Kick green */
  --text: #e6e8ec;
  --muted: #9aa3b2;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, sans-serif;
}

main { max-width: 1100px; margin: 0 auto; padding: 24px; }

h1 { color: var(--accent); }

section {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

input, button {
  font: inherit;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}

button { cursor: pointer; }
button.primary { background: var(--accent); color: #000; border: none; font-weight: 600; }

.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.muted { color: var(--muted); font-size: 0.9em; }
.error { color: #ff6b6b; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
ul.feed { list-style: none; padding: 0; margin: 0; max-height: 60vh; overflow-y: auto; }
ul.feed li { border-bottom: 1px solid var(--border); padding: 8px 0; font-size: 0.9em; }
ul.feed li code { color: var(--accent); }
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: completes without errors, `node_modules/` created.

- [ ] **Step 3: Verify the app builds**

Run: `npm run build`
Expected: `✓ Compiled successfully`, route `/` listed in output.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with vitest"
```

---

### Task 2: Event bus with ring buffer

**Files:**
- Create: `lib/event-bus.ts`
- Test: `tests/event-bus.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `eventBus` singleton with `publish(event: KickEvent): void`, `buffer: KickEvent[]` (max 100, oldest dropped), and EventEmitter `on("event", (e: KickEvent) => void)` / `off("event", ...)`. Type `KickEvent = { id: string; type: string; receivedAt: string; payload: unknown }`.

- [ ] **Step 1: Write the failing test**

`tests/event-bus.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { eventBus, KickEvent } from "@/lib/event-bus";

function makeEvent(n: number): KickEvent {
  return { id: `id-${n}`, type: "test.event", receivedAt: "2026-07-27T00:00:00Z", payload: { n } };
}

describe("eventBus", () => {
  it("notifies listeners on publish", () => {
    const listener = vi.fn();
    eventBus.on("event", listener);
    const event = makeEvent(1);
    eventBus.publish(event);
    eventBus.off("event", listener);
    expect(listener).toHaveBeenCalledWith(event);
  });

  it("buffers published events in order", () => {
    eventBus.buffer.length = 0;
    eventBus.publish(makeEvent(1));
    eventBus.publish(makeEvent(2));
    expect(eventBus.buffer.map((e) => e.id)).toEqual(["id-1", "id-2"]);
  });

  it("caps the buffer at 100 events, dropping oldest", () => {
    eventBus.buffer.length = 0;
    for (let i = 0; i < 105; i++) eventBus.publish(makeEvent(i));
    expect(eventBus.buffer).toHaveLength(100);
    expect(eventBus.buffer[0].id).toBe("id-5");
    expect(eventBus.buffer[99].id).toBe("id-104");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/event-bus.test.ts`
Expected: FAIL — `Cannot find module '@/lib/event-bus'` (or equivalent resolve error).

- [ ] **Step 3: Write minimal implementation**

`lib/event-bus.ts`:

```ts
import { EventEmitter } from "events";

export type KickEvent = {
  id: string;
  type: string;
  receivedAt: string;
  payload: unknown;
};

const MAX_BUFFER = 100;

class EventBus extends EventEmitter {
  buffer: KickEvent[] = [];

  publish(event: KickEvent) {
    this.buffer.push(event);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
    this.emit("event", event);
  }
}

declare global {
  // survives Next.js dev-mode module reloads
  var __kickEventBus: EventBus | undefined;
}

export const eventBus: EventBus = (globalThis.__kickEventBus ??= new EventBus());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/event-bus.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/event-bus.ts tests/event-bus.test.ts
git commit -m "feat: in-memory event bus with 100-event ring buffer"
```

---

### Task 3: Webhook signature verification

**Files:**
- Create: `lib/verify-signature.ts`, `tests/helpers/test-keys.ts`
- Test: `tests/verify-signature.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `verifyKickSignature(publicKeyPem: string, messageId: string, timestamp: string, rawBody: string, signatureB64: string): boolean` — RSA PKCS1v15 + SHA-256 over `"{messageId}.{timestamp}.{rawBody}"`; returns `false` (never throws) on any malformed input. Also `tests/helpers/test-keys.ts` exporting `{ publicKey, privateKey, signPayload(messageId, timestamp, rawBody): string }` reused by Task 6's webhook test.

- [ ] **Step 1: Write the test helper**

`tests/helpers/test-keys.ts`:

```ts
import { generateKeyPairSync, createSign } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

export { publicKey, privateKey };

export function signPayload(messageId: string, timestamp: string, rawBody: string): string {
  const sign = createSign("RSA-SHA256");
  sign.update(`${messageId}.${timestamp}.${rawBody}`);
  return sign.sign(privateKey).toString("base64");
}
```

- [ ] **Step 2: Write the failing test**

`tests/verify-signature.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { verifyKickSignature } from "@/lib/verify-signature";
import { publicKey, signPayload } from "./helpers/test-keys";

const messageId = "01J8XAMPLE";
const timestamp = "2026-07-27T10:00:00Z";
const rawBody = JSON.stringify({ content: "hello chat" });

describe("verifyKickSignature", () => {
  it("accepts a valid signature", () => {
    const sig = signPayload(messageId, timestamp, rawBody);
    expect(verifyKickSignature(publicKey, messageId, timestamp, rawBody, sig)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signPayload(messageId, timestamp, rawBody);
    expect(verifyKickSignature(publicKey, messageId, timestamp, rawBody + "x", sig)).toBe(false);
  });

  it("rejects a signature made for a different message id", () => {
    const sig = signPayload("other-id", timestamp, rawBody);
    expect(verifyKickSignature(publicKey, messageId, timestamp, rawBody, sig)).toBe(false);
  });

  it("returns false (does not throw) on garbage inputs", () => {
    expect(verifyKickSignature("not-a-pem", messageId, timestamp, rawBody, "!!!")).toBe(false);
    expect(verifyKickSignature(publicKey, messageId, timestamp, rawBody, "not-base64-signature")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/verify-signature.test.ts`
Expected: FAIL — `Cannot find module '@/lib/verify-signature'`.

- [ ] **Step 4: Write minimal implementation**

`lib/verify-signature.ts`:

```ts
import { createVerify } from "crypto";

export function verifyKickSignature(
  publicKeyPem: string,
  messageId: string,
  timestamp: string,
  rawBody: string,
  signatureB64: string
): boolean {
  try {
    const verify = createVerify("RSA-SHA256");
    verify.update(`${messageId}.${timestamp}.${rawBody}`);
    return verify.verify(publicKeyPem, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/verify-signature.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/verify-signature.ts tests/verify-signature.test.ts tests/helpers/test-keys.ts
git commit -m "feat: RSA webhook signature verification"
```

---

### Task 4: App access token manager

**Files:**
- Create: `lib/kick-token.ts`
- Test: `tests/kick-token.test.ts`

**Interfaces:**
- Consumes: env vars `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`.
- Produces: `getAppToken(): Promise<string>` (cached; refreshes within 60s of expiry; throws `Error` with status + body on failure) and `_resetTokenCache(): void` (tests only).

- [ ] **Step 1: Write the failing test**

`tests/kick-token.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAppToken, _resetTokenCache } from "@/lib/kick-token";

function mockTokenResponse(token: string, expiresIn: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: token, token_type: "Bearer", expires_in: expiresIn }),
    text: async () => "",
  } as Response;
}

describe("getAppToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T10:00:00Z"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("KICK_CLIENT_ID", "test-client-id");
    vi.stubEnv("KICK_CLIENT_SECRET", "test-client-secret");
    fetchMock.mockReset();
    _resetTokenCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("fetches a token with the client credentials grant", async () => {
    fetchMock.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    const token = await getAppToken();
    expect(token).toBe("tok-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://id.kick.com/oauth/token");
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("test-client-id");
    expect(body.get("client_secret")).toBe("test-client-secret");
  });

  it("reuses the cached token while valid", async () => {
    fetchMock.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    await getAppToken();
    const token = await getAppToken();
    expect(token).toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes when within 60s of expiry", async () => {
    fetchMock.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    await getAppToken();
    vi.setSystemTime(new Date("2026-07-27T10:59:30Z")); // 30s before expiry
    fetchMock.mockResolvedValueOnce(mockTokenResponse("tok-2", 3600));
    const token = await getAppToken();
    expect(token).toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws with status and body on failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "invalid client",
    } as Response);
    await expect(getAppToken()).rejects.toThrow(/401.*invalid client/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kick-token.test.ts`
Expected: FAIL — `Cannot find module '@/lib/kick-token'`.

- [ ] **Step 3: Write minimal implementation**

`lib/kick-token.ts`:

```ts
const TOKEN_URL = "https://id.kick.com/oauth/token";
const REFRESH_MARGIN_MS = 60_000;

let cached: { accessToken: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return cached.accessToken;
  }

  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("KICK_CLIENT_ID and KICK_CLIENT_SECRET must be set");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cached = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached.accessToken;
}

export function _resetTokenCache() {
  cached = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kick-token.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/kick-token.ts tests/kick-token.test.ts
git commit -m "feat: cached app access token via client credentials grant"
```

---

### Task 5: Kick API client

**Files:**
- Create: `lib/kick-api.ts`
- Test: `tests/kick-api.test.ts`

**Interfaces:**
- Consumes: `getAppToken()` from `@/lib/kick-token`.
- Produces:
  - `class KickApiError extends Error { status: number; body: string }`
  - `getChannelBySlug(slug: string): Promise<KickChannel | null>` where `KickChannel = { broadcaster_user_id: number; slug: string; stream_title: string; channel_description: string; banner_picture: string; category: { name: string } | null; stream: { is_live: boolean; viewer_count: number; start_time: string } | null }` (subset typing; extra fields pass through)
  - `WATCHED_EVENTS: string[]` — the six event names
  - `listSubscriptions(): Promise<KickSubscription[]>` where `KickSubscription = { id: string; event: string; version: number; broadcaster_user_id: number }`
  - `subscribeToChannel(broadcasterUserId: number): Promise<unknown>`
  - `deleteSubscriptions(ids: string[]): Promise<void>`
  - `getKickPublicKey(): Promise<string>` (cached after first fetch)

- [ ] **Step 1: Write the failing test**

`tests/kick-api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/kick-token", () => ({
  getAppToken: vi.fn(async () => "test-token"),
}));

import {
  getChannelBySlug,
  subscribeToChannel,
  KickApiError,
  WATCHED_EVENTS,
} from "@/lib/kick-api";

describe("kick-api", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getChannelBySlug returns the first channel with a bearer token", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ slug: "somechannel", broadcaster_user_id: 42 }] }),
      text: async () => "",
    } as Response);

    const channel = await getChannelBySlug("somechannel");
    expect(channel?.broadcaster_user_id).toBe(42);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kick.com/public/v1/channels?slug=somechannel");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("getChannelBySlug returns null when no channel matches", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
      text: async () => "",
    } as Response);
    expect(await getChannelBySlug("nope")).toBeNull();
  });

  it("subscribeToChannel posts all watched events for the broadcaster", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
      text: async () => "",
    } as Response);

    await subscribeToChannel(42);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kick.com/public/v1/events/subscriptions");
    const body = JSON.parse(init.body);
    expect(body.broadcaster_user_id).toBe(42);
    expect(body.method).toBe("webhook");
    expect(body.events).toEqual(WATCHED_EVENTS.map((name) => ({ name, version: 1 })));
  });

  it("throws KickApiError with status and body on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => "forbidden",
    } as Response);
    await expect(getChannelBySlug("x")).rejects.toThrow(KickApiError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kick-api.test.ts`
Expected: FAIL — `Cannot find module '@/lib/kick-api'`.

- [ ] **Step 3: Write minimal implementation**

`lib/kick-api.ts`:

```ts
import { getAppToken } from "@/lib/kick-token";

const API_BASE = "https://api.kick.com";

export class KickApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`Kick API ${status}: ${body}`);
    this.name = "KickApiError";
  }
}

export type KickChannel = {
  broadcaster_user_id: number;
  slug: string;
  stream_title: string;
  channel_description: string;
  banner_picture: string;
  category: { name: string } | null;
  stream: { is_live: boolean; viewer_count: number; start_time: string } | null;
};

export type KickSubscription = {
  id: string;
  event: string;
  version: number;
  broadcaster_user_id: number;
};

export const WATCHED_EVENTS = [
  "chat.message.sent",
  "channel.followed",
  "channel.subscription.new",
  "channel.subscription.gifts",
  "kicks.gifted",
  "livestream.status.updated",
];

async function kickFetch(path: string, init?: { method?: string; body?: string }) {
  const token = await getAppToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body,
  });
  if (!res.ok) throw new KickApiError(res.status, await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export async function getChannelBySlug(slug: string): Promise<KickChannel | null> {
  const data = await kickFetch(`/public/v1/channels?slug=${encodeURIComponent(slug)}`);
  return data?.data?.[0] ?? null;
}

export async function listSubscriptions(): Promise<KickSubscription[]> {
  const data = await kickFetch("/public/v1/events/subscriptions");
  return data?.data ?? [];
}

export async function subscribeToChannel(broadcasterUserId: number): Promise<unknown> {
  const data = await kickFetch("/public/v1/events/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      broadcaster_user_id: broadcasterUserId,
      method: "webhook",
      events: WATCHED_EVENTS.map((name) => ({ name, version: 1 })),
    }),
  });
  return data?.data;
}

export async function deleteSubscriptions(ids: string[]): Promise<void> {
  const qs = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&");
  await kickFetch(`/public/v1/events/subscriptions?${qs}`, { method: "DELETE" });
}

let publicKeyCache: string | null = null;

export async function getKickPublicKey(): Promise<string> {
  if (publicKeyCache) return publicKeyCache;
  const res = await fetch(`${API_BASE}/public/v1/public-key`);
  if (!res.ok) throw new KickApiError(res.status, await res.text());
  const data = await res.json();
  publicKeyCache = data.data.public_key as string;
  return publicKeyCache;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kick-api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/kick-api.ts tests/kick-api.test.ts
git commit -m "feat: Kick REST client (channels, event subscriptions, public key)"
```

---

### Task 6: Webhook receiver and fake-event route

**Files:**
- Create: `app/api/kick/webhook/route.ts`, `app/api/fake-event/route.ts`
- Test: `tests/webhook-route.test.ts`

**Interfaces:**
- Consumes: `verifyKickSignature` (Task 3), `getKickPublicKey` (Task 5), `eventBus`/`KickEvent` (Task 2), `signPayload`/`publicKey` from `tests/helpers/test-keys.ts` (Task 3).
- Produces: `POST /api/kick/webhook` (401 on bad signature, 200 + bus publish on success) and `POST /api/fake-event` with optional JSON `{ type?: string }` publishing a synthetic event typed `fake:<type>`.

- [ ] **Step 1: Write the failing test**

`tests/webhook-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/kick-api", async () => {
  const { publicKey } = await import("./helpers/test-keys");
  return { getKickPublicKey: async () => publicKey };
});

import { POST } from "@/app/api/kick/webhook/route";
import { eventBus } from "@/lib/event-bus";
import { signPayload } from "./helpers/test-keys";

function webhookRequest(rawBody: string, signature: string) {
  return new Request("http://localhost/api/kick/webhook", {
    method: "POST",
    headers: {
      "Kick-Event-Message-Id": "01JMSGID",
      "Kick-Event-Message-Timestamp": "2026-07-27T10:00:00Z",
      "Kick-Event-Signature": signature,
      "Kick-Event-Type": "chat.message.sent",
      "Kick-Event-Version": "1",
    },
    body: rawBody,
  });
}

describe("POST /api/kick/webhook", () => {
  beforeEach(() => {
    eventBus.buffer.length = 0;
  });

  it("accepts a correctly signed event and publishes it", async () => {
    const rawBody = JSON.stringify({ content: "hello", sender: { username: "viewer1" } });
    const sig = signPayload("01JMSGID", "2026-07-27T10:00:00Z", rawBody);
    const res = await POST(webhookRequest(rawBody, sig));
    expect(res.status).toBe(200);
    expect(eventBus.buffer).toHaveLength(1);
    expect(eventBus.buffer[0]).toMatchObject({
      id: "01JMSGID",
      type: "chat.message.sent",
      payload: { content: "hello" },
    });
  });

  it("rejects a bad signature with 401 and publishes nothing", async () => {
    const rawBody = JSON.stringify({ content: "hello" });
    const sig = signPayload("01JMSGID", "2026-07-27T10:00:00Z", rawBody + "tampered");
    const res = await POST(webhookRequest(rawBody, sig));
    expect(res.status).toBe(401);
    expect(eventBus.buffer).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/webhook-route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/kick/webhook/route'`.

- [ ] **Step 3: Write the webhook route**

`app/api/kick/webhook/route.ts`:

```ts
import { eventBus } from "@/lib/event-bus";
import { getKickPublicKey } from "@/lib/kick-api";
import { verifyKickSignature } from "@/lib/verify-signature";

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const messageId = req.headers.get("kick-event-message-id") ?? "";
  const timestamp = req.headers.get("kick-event-message-timestamp") ?? "";
  const signature = req.headers.get("kick-event-signature") ?? "";
  const type = req.headers.get("kick-event-type") ?? "unknown";

  const publicKey = await getKickPublicKey();
  if (!verifyKickSignature(publicKey, messageId, timestamp, rawBody, signature)) {
    console.warn("Rejected webhook: bad signature", { messageId, type });
    return new Response("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid JSON body", { status: 400 });
  }

  eventBus.publish({ id: messageId, type, receivedAt: new Date().toISOString(), payload });
  return new Response("ok");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/webhook-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the fake-event route**

`app/api/fake-event/route.ts`:

```ts
import { randomUUID } from "crypto";
import { eventBus } from "@/lib/event-bus";

const SAMPLE_PAYLOADS: Record<string, unknown> = {
  "chat.message.sent": {
    message_id: "fake-msg",
    content: "LETS GOOO 🔥",
    sender: { user_id: 1, username: "fake_viewer", identity: { username_color: "#53fc18" } },
  },
  "kicks.gifted": {
    gifter: { user_id: 2, username: "fake_whale" },
    gift: { amount: 100, name: "Hype Rocket", type: "KICKS", tier: "large", message: "take my kicks" },
  },
  "channel.followed": {
    follower: { user_id: 3, username: "fake_follower" },
  },
};

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const type = typeof body?.type === "string" ? body.type : "chat.message.sent";

  eventBus.publish({
    id: randomUUID(),
    type: `fake:${type}`,
    receivedAt: new Date().toISOString(),
    payload: SAMPLE_PAYLOADS[type] ?? { note: "synthetic event" },
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — all test files green.

- [ ] **Step 7: Commit**

```bash
git add app/api/kick/webhook/route.ts app/api/fake-event/route.ts tests/webhook-route.test.ts
git commit -m "feat: signed webhook receiver and fake-event injector"
```

---

### Task 7: SSE stream endpoint

**Files:**
- Create: `app/api/events/stream/route.ts`

**Interfaces:**
- Consumes: `eventBus`, `KickEvent` (Task 2).
- Produces: `GET /api/events/stream` — `text/event-stream` that first replays `eventBus.buffer`, then streams live events as `data: <json>\n\n`, with a `: ping` heartbeat every 25s. Consumed by `LiveFeed` (Task 9) via `EventSource`.

- [ ] **Step 1: Write the route**

`app/api/events/stream/route.ts`:

```ts
import { eventBus, KickEvent } from "@/lib/event-bus";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let listener: ((e: KickEvent) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: KickEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      for (const e of eventBus.buffer) send(e);

      listener = send;
      eventBus.on("event", listener);
      heartbeat = setInterval(
        () => controller.enqueue(encoder.encode(": ping\n\n")),
        HEARTBEAT_MS
      );
    },
    cancel() {
      if (listener) eventBus.off("event", listener);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify manually end-to-end**

Terminal 1: `npm run dev`
Terminal 2: `curl -N http://localhost:3000/api/events/stream`
Terminal 3: `curl -X POST http://localhost:3000/api/fake-event -H "Content-Type: application/json" -d '{"type":"kicks.gifted"}'`

Expected: terminal 2 prints a `data: {"id":...,"type":"fake:kicks.gifted",...}` line within a second of the terminal-3 POST. Ctrl-C terminal 2; dev server logs no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/events/stream/route.ts
git commit -m "feat: SSE event stream with buffer replay and heartbeat"
```

---

### Task 8: Channel and subscriptions JSON APIs

**Files:**
- Create: `app/api/channel/route.ts`, `app/api/subscriptions/route.ts`

**Interfaces:**
- Consumes: `getChannelBySlug`, `listSubscriptions`, `subscribeToChannel`, `deleteSubscriptions`, `KickApiError` (Task 5).
- Produces:
  - `GET /api/channel?slug=<slug>` → `200 KickChannel` | `400 {error}` | `404 {error}` | `502 {error}`
  - `GET /api/subscriptions` → `200 KickSubscription[]`
  - `POST /api/subscriptions` body `{broadcaster_user_id: number}` → `200 {ok: true}`
  - `DELETE /api/subscriptions` body `{ids: string[]}` → `200 {ok: true}`
  - All Kick failures mapped to `502 {error: "Kick API <status>: <body>"}`; token/config failures to `500 {error}`.

- [ ] **Step 1: Write a shared error helper and the channel route**

Next.js route files may only export HTTP methods and route config, so the error helper lives in `lib/http.ts`.

`lib/http.ts`:

```ts
import { KickApiError } from "@/lib/kick-api";

export function kickErrorResponse(e: unknown): Response {
  if (e instanceof KickApiError) {
    return Response.json({ error: e.message }, { status: 502 });
  }
  const message = e instanceof Error ? e.message : "unknown error";
  return Response.json({ error: message }, { status: 500 });
}
```

`app/api/channel/route.ts`:

```ts
import { getChannelBySlug } from "@/lib/kick-api";
import { kickErrorResponse } from "@/lib/http";

export async function GET(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) return Response.json({ error: "slug query param required" }, { status: 400 });

  try {
    const channel = await getChannelBySlug(slug);
    if (!channel) return Response.json({ error: `channel "${slug}" not found` }, { status: 404 });
    return Response.json(channel);
  } catch (e) {
    return kickErrorResponse(e);
  }
}
```

- [ ] **Step 2: Write the subscriptions route**

`app/api/subscriptions/route.ts`:

```ts
import { listSubscriptions, subscribeToChannel, deleteSubscriptions } from "@/lib/kick-api";
import { kickErrorResponse } from "@/lib/http";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listSubscriptions());
  } catch (e) {
    return kickErrorResponse(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const broadcasterUserId = Number(body?.broadcaster_user_id);
  if (!Number.isInteger(broadcasterUserId) || broadcasterUserId <= 0) {
    return Response.json({ error: "broadcaster_user_id (positive integer) required" }, { status: 400 });
  }
  try {
    await subscribeToChannel(broadcasterUserId);
    return Response.json({ ok: true });
  } catch (e) {
    return kickErrorResponse(e);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return Response.json({ error: "ids (non-empty string array) required" }, { status: 400 });
  }
  try {
    await deleteSubscriptions(ids);
    return Response.json({ ok: true });
  } catch (e) {
    return kickErrorResponse(e);
  }
}
```

- [ ] **Step 3: Verify manually against the real Kick API**

Prerequisite: create `.env.local` with the real `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` (copy from `.env.example`).

Terminal 1: `npm run dev`
Terminal 2:
- `curl "http://localhost:3000/api/channel"` → expect `400 {"error":"slug query param required"}`
- `curl "http://localhost:3000/api/channel?slug=<a real live channel slug, e.g. from kick.com front page>"` → expect 200 JSON with `broadcaster_user_id`, `stream`, etc.
- `curl "http://localhost:3000/api/subscriptions"` → expect `200 []` (no subscriptions yet)

Expected: all three as stated. If the channel call returns 502 with a 401 body, the credentials in `.env.local` are wrong — fix before continuing.

- [ ] **Step 4: Run the full test suite (regression)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/channel/route.ts app/api/subscriptions/route.ts lib/http.ts
git commit -m "feat: channel lookup and subscription management APIs"
```

---

### Task 9: UI — channel lookup, live feed, subscriptions panel

**Files:**
- Create: `components/channel-lookup.tsx`, `components/live-feed.tsx`, `components/subscriptions-panel.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `GET /api/channel?slug=`, `GET/POST/DELETE /api/subscriptions`, `GET /api/events/stream`, `POST /api/fake-event` (Tasks 6–8), `KickChannel`/`KickSubscription` types (Task 5), `KickEvent` type (Task 2).
- Produces: the complete page UI. No component exports consumed by later tasks.

- [ ] **Step 1: Write the channel lookup component**

`components/channel-lookup.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { KickChannel } from "@/lib/kick-api";

export default function ChannelLookup() {
  const [slug, setSlug] = useState("");
  const [channel, setChannel] = useState<KickChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    setError(null);
    setStatus(null);
    setChannel(null);
    try {
      const res = await fetch(`/api/channel?slug=${encodeURIComponent(slug.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setChannel(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function watch() {
    if (!channel) return;
    setStatus(null);
    setError(null);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ broadcaster_user_id: channel.broadcaster_user_id }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
    else setStatus(`Subscribed to events for ${channel.slug}. Events will appear in the live feed once Kick's webhook URL points at this deployment.`);
  }

  return (
    <section>
      <h2>Channel lookup</h2>
      <div className="row">
        <input
          placeholder="channel slug, e.g. xqc"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && slug.trim() && lookup()}
        />
        <button className="primary" onClick={lookup} disabled={loading || !slug.trim()}>
          {loading ? "Loading…" : "Look up"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {status && <p className="muted">{status}</p>}
      {channel && (
        <div>
          <h3>{channel.slug}</h3>
          <p>
            {channel.stream?.is_live ? (
              <>🟢 LIVE — {channel.stream.viewer_count} viewers</>
            ) : (
              <>⚫ Offline</>
            )}
          </p>
          <p>{channel.stream_title || <span className="muted">no title</span>}</p>
          <p className="muted">
            Category: {channel.category?.name ?? "—"} · Broadcaster ID: {channel.broadcaster_user_id}
          </p>
          <button className="primary" onClick={watch}>Watch this channel (subscribe to events)</button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Write the live feed component**

`components/live-feed.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { KickEvent } from "@/lib/event-bus";

const MAX_SHOWN = 50;

function summarize(e: KickEvent): string {
  const p = e.payload as Record<string, any>;
  switch (e.type.replace(/^fake:/, "")) {
    case "chat.message.sent":
      return `${p?.sender?.username ?? "?"}: ${p?.content ?? ""}`;
    case "channel.followed":
      return `${p?.follower?.username ?? "?"} followed`;
    case "kicks.gifted":
      return `${p?.gifter?.username ?? "?"} gifted ${p?.gift?.amount ?? "?"} KICKs (${p?.gift?.name ?? ""})`;
    case "channel.subscription.new":
      return `new sub`;
    case "channel.subscription.gifts":
      return `gifted subs`;
    case "livestream.status.updated":
      return p?.is_live ? "stream went LIVE" : "stream ended";
    default:
      return JSON.stringify(p).slice(0, 120);
  }
}

export default function LiveFeed() {
  const [events, setEvents] = useState<KickEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (msg) => {
      const event: KickEvent = JSON.parse(msg.data);
      setEvents((prev) => [event, ...prev].slice(0, MAX_SHOWN));
    };
    return () => source.close();
  }, []);

  async function inject(type: string) {
    await fetch("/api/fake-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
  }

  return (
    <section>
      <h2>Live feed {connected ? "🟢" : "🔴 (reconnecting…)"}</h2>
      <div className="row">
        <span className="muted">Inject fake:</span>
        <button onClick={() => inject("chat.message.sent")}>chat</button>
        <button onClick={() => inject("channel.followed")}>follow</button>
        <button onClick={() => inject("kicks.gifted")}>kicks gift</button>
      </div>
      <ul className="feed">
        {events.length === 0 && <li className="muted">No events yet — inject a fake one or subscribe to a live channel.</li>}
        {events.map((e) => (
          <li key={e.id}>
            <code>{e.type}</code> {summarize(e)}
            <span className="muted"> · {new Date(e.receivedAt).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Write the subscriptions panel**

`components/subscriptions-panel.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { KickSubscription } from "@/lib/kick-api";

export default function SubscriptionsPanel() {
  const [subs, setSubs] = useState<KickSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/subscriptions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSubs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load subscriptions");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function unsubscribe(id: string) {
    await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    refresh();
  }

  return (
    <section>
      <div className="row">
        <h2>Event subscriptions</h2>
        <button onClick={refresh}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      {subs.length === 0 && !error && <p className="muted">No active subscriptions.</p>}
      <ul className="feed">
        {subs.map((s) => (
          <li key={s.id}>
            <code>{s.event}</code> · broadcaster {s.broadcaster_user_id}{" "}
            <button onClick={() => unsubscribe(s.id)}>Unsubscribe</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Wire up the page**

Replace `app/page.tsx`:

```tsx
import ChannelLookup from "@/components/channel-lookup";
import LiveFeed from "@/components/live-feed";
import SubscriptionsPanel from "@/components/subscriptions-panel";

export default function Home() {
  return (
    <main>
      <h1>Kick Hype Starter</h1>
      <p className="muted">
        Pre-hackathon test rig: app-token REST reads, webhook ingestion, live SSE feed.
      </p>
      <div className="grid">
        <div>
          <ChannelLookup />
          <SubscriptionsPanel />
        </div>
        <LiveFeed />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify manually in the browser**

Run: `npm run dev`, open `http://localhost:3000`.

Expected:
1. Live feed shows 🟢 and "No events yet".
2. Clicking "kicks gift" inject button → `fake:kicks.gifted` appears at the top of the feed instantly.
3. Looking up a real channel slug shows live status, viewer count, title.
4. "Watch this channel" → success note appears; subscriptions panel Refresh lists 6 subscriptions for that broadcaster.
5. Unsubscribe each one (cleanup) → panel empties.

- [ ] **Step 6: Run build and tests (regression)**

Run: `npm run build && npm test`
Expected: build succeeds, all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx components/
git commit -m "feat: channel lookup, live SSE feed, and subscriptions UI"
```

---

### Task 10: README and Railway deployment guide

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything prior (documents it).
- Produces: setup + deploy documentation; no code.

- [ ] **Step 1: Write the README**

`README.md`:

````markdown
# Kick Hype Starter

Pre-hackathon test rig for the Kick public API: app-token REST reads,
signed webhook ingestion, and a live SSE event feed — the same pipeline a
"Hype Tracker" stream overlay needs.

## Local setup

1. `npm install`
2. `cp .env.example .env.local` and fill in the client ID/secret from
   https://kick.com/settings/developer (the Kick account needs 2FA enabled).
3. `npm run dev` → http://localhost:3000
4. Click an "Inject fake" button — the live feed should update instantly.
   Look up a channel slug to verify the credentials against the real API.

Real webhooks cannot reach localhost. Either deploy (below) or tunnel with
`ngrok http 3000` and use the ngrok URL in the Kick dashboard.

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway: New Project → Deploy from GitHub repo. Railway auto-detects
   Next.js (`npm run build` / `npm run start`).
3. Service → Variables: add `KICK_CLIENT_ID` and `KICK_CLIENT_SECRET`.
4. Service → Settings → Networking → Generate Domain. Note the URL,
   e.g. `https://kick-hype-starter-production.up.railway.app`.
5. In https://kick.com/settings/developer → your app → set the webhook URL to
   `https://<railway-domain>/api/kick/webhook` (webhooks toggle ON).

## Receiving real events

1. Open the deployed site, look up a **live** channel, click
   "Watch this channel".
2. Real chat/follow/gift events for that channel stream into the live feed.
3. Unsubscribe from the subscriptions panel when done — subscriptions
   outlive page reloads (they live on Kick's side, per app).

## Notes & limitations

- App access token (client credentials) only — no user OAuth needed for this.
- Events are held in memory (last 100). One instance only; a restart clears the feed.
- Webhook signatures are verified against Kick's published RSA key
  (`GET /public/v1/public-key`).
- If the endpoint keeps failing for >1 day Kick auto-drops subscriptions;
  re-subscribe from the UI.
- `npm test` runs the unit suite (token cache, signature verification,
  event bus, webhook route).
````

- [ ] **Step 2: Final full check**

Run: `npm run build && npm test`
Expected: build succeeds, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: setup and Railway deployment guide"
```

---

## Post-plan manual steps (user, not automatable)

1. Push the repo to GitHub and connect it to Railway; set the two env vars; generate the public domain.
2. Update the Kick app's webhook URL to `https://<railway-domain>/api/kick/webhook` (replacing the `https://myappgui-webhook.com` placeholder).
3. Subscribe to a live channel from the deployed UI and confirm real events arrive.
