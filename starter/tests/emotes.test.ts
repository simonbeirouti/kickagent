import { describe, expect, it } from "vitest";
import { extractEmoji, parseMessage } from "@/lib/emotes";

describe("parseMessage", () => {
  it("returns plain text as a single segment", () => {
    expect(parseMessage("hello chat")).toEqual([{ type: "text", value: "hello chat" }]);
  });

  it("parses an emote with surrounding text", () => {
    expect(parseMessage("gg [emote:37226:KEKW] wp")).toEqual([
      { type: "text", value: "gg " },
      { type: "emote", id: "37226", name: "KEKW" },
      { type: "text", value: " wp" },
    ]);
  });

  it("parses consecutive emotes and trailing emote", () => {
    expect(parseMessage("[emote:1:a][emote:2:b]")).toEqual([
      { type: "emote", id: "1", name: "a" },
      { type: "emote", id: "2", name: "b" },
    ]);
  });

  it("leaves malformed emote tags as text", () => {
    expect(parseMessage("[emote:notanumber:x]")).toEqual([
      { type: "text", value: "[emote:notanumber:x]" },
    ]);
  });
});

describe("extractEmoji", () => {
  it("pulls emoji out of text", () => {
    expect(extractEmoji("LETS GOOO 🔥🔥")).toEqual(["🔥", "🔥"]);
    expect(extractEmoji("no emoji here")).toEqual([]);
  });
});
