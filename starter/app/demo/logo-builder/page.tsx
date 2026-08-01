"use client";

import { useRef, useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents } from "@/lib/use-kick-events";
import { pointsFor } from "@/lib/hype-score";

// 5-row bitmaps; letters complete left-to-right for natural milestones
const LETTERS: string[][] = [
  ["X..X", "X.X.", "XX..", "X.X.", "X..X"], // K
  ["XXX", ".X.", ".X.", ".X.", "XXX"], // I
  [".XXX", "X...", "X...", "X...", ".XXX"], // C
  ["X..X", "X.X.", "XX..", "X.X.", "X..X"], // K
];
const LETTER_NAMES = ["K", "I", "C", "K"];
const BASE_POINTS_PER_BRICK = 6;

type Cell = { row: number; col: number };

// column-major fill order so each letter completes before the next begins
function buildGrid() {
  const cells: Cell[] = [];
  const letterEnd: number[] = [];
  let colOffset = 0;
  for (const letter of LETTERS) {
    const width = letter[0].length;
    for (let c = 0; c < width; c++) {
      for (let r = 0; r < 5; r++) {
        if (letter[r][c] === "X") cells.push({ row: r, col: colOffset + c });
      }
    }
    letterEnd.push(cells.length);
    colOffset += width + 1;
  }
  return { cells, letterEnd, totalCols: colOffset - 1 };
}

const GRID = buildGrid();

export default function LogoBuilderPage() {
  const pointsRef = useRef(0);
  const [bricks, setBricks] = useState(0);
  const [level, setLevel] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);

  const pointsPerBrick = BASE_POINTS_PER_BRICK * Math.pow(1.5, level - 1);

  const { connected } = useKickEvents((e) => {
    const pts = pointsFor(e.kind, e.payload);
    if (pts <= 0) return;
    pointsRef.current += pts;
    const target = Math.min(GRID.cells.length, Math.floor(pointsRef.current / pointsPerBrick));

    setBricks((prev) => {
      if (target <= prev) return prev;
      const crossed = GRID.letterEnd.findIndex((end) => prev < end && target >= end);
      if (crossed >= 0) {
        const done = target >= GRID.cells.length;
        setBanner(done ? `🏆 LOGO COMPLETE — LEVEL ${level + 1} UNLOCKED` : `🎉 "${LETTER_NAMES[crossed]}" complete!`);
        setTimeout(() => setBanner(null), 3_000);
        if (done) {
          pointsRef.current = 0;
          setLevel((l) => l + 1);
          setTimeout(() => setBricks(0), 2_500);
        }
      }
      return target;
    });
  });

  const pct = Math.round((bricks / GRID.cells.length) * 100);

  return (
    <PageChrome
      title="Logo Builder"
      subtitle="Straight from the brief: the KICK logo builds itself brick by brick as the stream hits hype milestones. Each level costs more hype."
      connected={connected}
    >
      <section className="logo-stage">
        <div className="boss-level">Level {level} · {pct}% built</div>
        {banner && <div className="logo-banner">{banner}</div>}
        <div
          className="logo-grid"
          style={{ gridTemplateColumns: `repeat(${GRID.totalCols}, 1fr)` }}
        >
          {GRID.cells.map((cell, i) => (
            <span
              key={i}
              className={`logo-brick ${i < bricks ? "logo-brick-on" : ""}`}
              style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
            />
          ))}
        </div>
        <p className="muted">
          Every hype point lays bricks — chat +2, follow +10, sub +25, KICKs by amount.
        </p>
      </section>
    </PageChrome>
  );
}
