import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allowedKickUserIds, isKickAccountAllowed } from "@/lib/kick/access";

const ENV_NAME = "KICK_ALLOWED_USER_ID";
const originalValue = process.env[ENV_NAME];

beforeEach(() => {
  delete process.env[ENV_NAME];
});

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env[ENV_NAME];
  } else {
    process.env[ENV_NAME] = originalValue;
  }
});

describe("Kick account allowlist", () => {
  it("allows any account when KICK_ALLOWED_USER_ID is unset", () => {
    expect(allowedKickUserIds()).toBe("any");
    expect(isKickAccountAllowed("4083762")).toBe(true);
    expect(isKickAccountAllowed("999999")).toBe(true);
  });

  it("allows any account when KICK_ALLOWED_USER_ID is empty or whitespace", () => {
    process.env[ENV_NAME] = "   ";
    expect(isKickAccountAllowed("4083762")).toBe(true);
    process.env[ENV_NAME] = " , , ";
    expect(isKickAccountAllowed("4083762")).toBe(true);
  });

  it("allows any account when KICK_ALLOWED_USER_ID is *", () => {
    process.env[ENV_NAME] = "*";
    expect(allowedKickUserIds()).toBe("any");
    expect(isKickAccountAllowed("123456")).toBe(true);
  });

  it("pins sign-in to a single id", () => {
    process.env[ENV_NAME] = "4083762";
    expect(allowedKickUserIds()).toEqual(["4083762"]);
    expect(isKickAccountAllowed("4083762")).toBe(true);
    expect(isKickAccountAllowed("4083763")).toBe(false);
  });

  it("supports a comma-separated allowlist with whitespace", () => {
    process.env[ENV_NAME] = " 4083762 , 123456 ";
    expect(allowedKickUserIds()).toEqual(["4083762", "123456"]);
    expect(isKickAccountAllowed("4083762")).toBe(true);
    expect(isKickAccountAllowed("123456")).toBe(true);
    expect(isKickAccountAllowed("777777")).toBe(false);
  });

  it("treats a * anywhere in the list as allow-any", () => {
    process.env[ENV_NAME] = "4083762,*";
    expect(allowedKickUserIds()).toBe("any");
    expect(isKickAccountAllowed("777777")).toBe(true);
  });
});
