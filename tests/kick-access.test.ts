import { describe, expect, it } from "vitest";
import { KICK_OWNER_USER_ID, isKickAccountAllowed } from "@/lib/kick/access";

describe("Kick account allowlist", () => {
  it("allows the pinned owner account", () => {
    expect(KICK_OWNER_USER_ID).toBe("4083762");
    expect(isKickAccountAllowed("4083762")).toBe(true);
  });

  it("rejects every other Kick account", () => {
    expect(isKickAccountAllowed("4083763")).toBe(false);
  });
});
