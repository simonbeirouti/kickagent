import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createStatelessAppSession,
  SESSION_COOKIE,
  statelessSessionFromRequest,
} from "@/lib/session";

describe("stateless Kick session", () => {
  beforeEach(() => {
    process.env.KICK_STATELESS_MODE = "true";
    process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key-with-at-least-32-characters";
  });

  afterEach(() => {
    delete process.env.KICK_STATELESS_MODE;
  });

  it("round-trips the Kick profile and channel through an encrypted cookie", () => {
    const created = createStatelessAppSession({
      channel: { isLive: false, slug: "bsimon" },
      profile: { email: "hello@simonbeirouti.com", name: "bsimon", userId: "4083762" },
    });
    const request = new Request("http://localhost/api/overlay/state", {
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(created.token)}` },
    });

    expect(statelessSessionFromRequest(request)).toMatchObject({
      channel: { slug: "bsimon" },
      profile: { userId: "4083762" },
      version: 1,
    });
  });

  it("rejects an invalid stateless cookie", () => {
    const request = new Request("http://localhost/api/overlay/state", {
      headers: { cookie: `${SESSION_COOKIE}=invalid` },
    });
    expect(statelessSessionFromRequest(request)).toBeUndefined();
  });
});
