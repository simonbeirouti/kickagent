import { beforeEach, describe, expect, it } from "vitest";
import { resetAssistantStore } from "@/lib/assistant/bets-store";
import { GET as getState } from "@/app/api/assistant/state/route";
import { POST as createPredictionRoute } from "@/app/api/assistant/predictions/route";
import { POST as wagerRoute } from "@/app/api/assistant/predictions/[id]/wager/route";
import { POST as createBetRoute } from "@/app/api/assistant/bets/route";
import { POST as betActionRoute } from "@/app/api/assistant/bets/[id]/route";
import { POST as demoRoute } from "@/app/api/assistant/demo/route";

const post = (body: unknown) =>
  new Request("http://localhost/api/assistant/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  resetAssistantStore();
});

describe("GET /api/assistant/state", () => {
  it("returns hype, predictions, bets and demo status", async () => {
    const res = await getState();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hype).toMatchObject({ score: expect.any(Number), velocity: expect.any(Number) });
    expect(Array.isArray(body.predictions)).toBe(true);
    expect(Array.isArray(body.bets)).toBe(true);
    expect(body.demo).toMatchObject({ playing: expect.any(Boolean) });
  });
});

describe("POST /api/assistant/predictions", () => {
  it("creates a prediction", async () => {
    const res = await createPredictionRoute(post({ question: "Will it work?", durationMinutes: 30 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.question).toBe("Will it work?");
    expect(body.odds).toEqual({ yes: 50, no: 50 });
  });

  it("400s without a question", async () => {
    const res = await createPredictionRoute(post({}));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/assistant/predictions/:id/wager", () => {
  it("places a wager and returns updated odds", async () => {
    const created = await (await createPredictionRoute(post({ question: "q" }))).json();
    const res = await wagerRoute(
      post({ user: "HypeKing", side: "yes", amount: 100 }),
      params(created.id),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pools.yes).toBe(100);
  });

  it("400s on a bad side and 404s on unknown prediction", async () => {
    const created = await (await createPredictionRoute(post({ question: "q" }))).json();
    const bad = await wagerRoute(post({ user: "u", side: "maybe", amount: 10 }), params(created.id));
    expect(bad.status).toBe(400);
    const missing = await wagerRoute(post({ user: "u", side: "yes", amount: 10 }), params("nope"));
    expect(missing.status).toBe(404);
  });
});

describe("POST /api/assistant/bets", () => {
  it("creates an open action bet", async () => {
    const res = await createBetRoute(
      post({ user: "HypeKing", wager: 50, condition: "talk to the girls" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("open");
  });

  it("400s on missing fields", async () => {
    expect((await createBetRoute(post({ user: "u" }))).status).toBe(400);
  });
});

describe("POST /api/assistant/bets/:id", () => {
  it("accepts an open bet", async () => {
    const bet = await (
      await createBetRoute(post({ user: "u", wager: 10, condition: "c" }))
    ).json();
    const res = await betActionRoute(post({ action: "accept" }), params(bet.id));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("accepted");
  });

  it("409s on an invalid transition and 400s on unknown action", async () => {
    const bet = await (
      await createBetRoute(post({ user: "u", wager: 10, condition: "c" }))
    ).json();
    expect((await betActionRoute(post({ action: "validate" }), params(bet.id))).status).toBe(409);
    expect((await betActionRoute(post({ action: "yolo" }), params(bet.id))).status).toBe(400);
    expect((await betActionRoute(post({ action: "accept" }), params("nope"))).status).toBe(404);
  });
});

describe("POST /api/assistant/demo", () => {
  it("stops and reports status; 400s on unknown action", async () => {
    const res = await demoRoute(post({ action: "stop" }));
    expect(res.status).toBe(200);
    expect((await res.json()).playing).toBe(false);
    expect((await demoRoute(post({ action: "yolo" }))).status).toBe(400);
  });
});
