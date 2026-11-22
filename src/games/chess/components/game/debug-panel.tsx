"use client";

import { useState } from "react";
import { lineToSan, toSan } from "../../engine/notation";
import { Position } from "../../engine/position";
import { positionAfter, resolvePuzzle } from "../../engine/puzzle";
import type { ChessPuzzle } from "../../engine/types";
import { validateChessPuzzle } from "../../engine/validate";

type Props = { puzzle: ChessPuzzle; generationMs: number };

/** Development only. The game container never imports this file in production builds. */
export default function ChessDebugPanel({ puzzle, generationMs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  // Computed once per panel. The container keys the view by puzzle id, so a new puzzle mounts a new panel.
  const [details] = useState(() => {
    const resolved = resolvePuzzle(puzzle);
    const started = performance.now();
    const check = validateChessPuzzle(puzzle);
    return {
      setup: toSan(Position.fromFen(puzzle.fen), resolved.setup),
      solution: lineToSan(positionAfter(resolved, []), resolved.line),
      check: check.ok ? "ok" : check.errors.join("; "),
      checkMs: performance.now() - started,
    };
  });

  const rows: [string, string | number][] = [
    ["seed", puzzle.seed],
    ["puzzle id", puzzle.id],
    ["generator version", puzzle.version],
    ["difficulty", puzzle.difficulty],
    ["recipe", `${puzzle.metadata.recipe} (${puzzle.kind}${puzzle.mateIn ? `, mate in ${puzzle.mateIn}` : ""})`],
    ["themes", puzzle.themes.join(", ") || "none"],
    ["start", puzzle.fen],
    ["opening move", details.setup],
    ["solution", showSolution ? details.solution : "hidden"],
    ["mined", `game ${puzzle.metadata.games}, ply ${puzzle.metadata.ply}, ${puzzle.metadata.pieces} pieces, gain ${puzzle.metadata.gain}`],
    ["validator", `${details.check}, ${details.checkMs.toFixed(1)} ms`],
    ["generation", `${generationMs.toFixed(1)} ms, ${puzzle.metadata.nodes} nodes`],
  ];

  return (
    <aside className="w-full rounded-xl text-xs font-mono p-3" style={{ background: "#1f1b2e", color: "#e8e3ff" }} data-testid="chess-debug">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="font-bold" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? "▾" : "▸"} debug
        </button>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showSolution}
            onChange={(event) => {
              setShowSolution(event.target.checked);
              if (event.target.checked) setExpanded(true);
            }}
          />{" "}
          show solution
        </label>
      </div>
      {expanded && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mt-2" style={{ userSelect: "text" }}>
          {rows.map(([name, value]) => (
            <div key={name} className="contents">
              <dt className="opacity-60">{name}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}
