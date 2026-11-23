"use client";

import { useState } from "react";
import { validateWendPuzzle } from "../../engine/generator";
import type { WendPuzzle } from "../../engine/types";

type Props = { puzzle: WendPuzzle; generationMs: number; showSolution: boolean; onToggleSolution: (value: boolean) => void };

/** Development only. The game container never imports this file in production builds. */
export default function WendDebugPanel({ puzzle, generationMs, showSolution, onToggleSolution }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [check] = useState(() => {
    const started = performance.now();
    const result = validateWendPuzzle(puzzle);
    return { ms: performance.now() - started, text: result.ok ? "ok" : result.problems.join(" ") };
  });
  const place = (cell: number) => `r${Math.floor(cell / puzzle.size) + 1}c${(cell % puzzle.size) + 1}`;

  const rows: [string, string | number][] = [
    ["seed", puzzle.seed],
    ["puzzle id", puzzle.id],
    ["generator version", puzzle.version],
    ["board", `${puzzle.size}x${puzzle.size}, ${puzzle.metadata.walls} walls, ${puzzle.words.length} words`],
    ["difficulty", puzzle.difficulty],
    ["theme", `${puzzle.theme}${puzzle.themeShown ? "" : " (hidden at first)"}`],
    ["bendiness", puzzle.metadata.bendiness.toFixed(2)],
    ["solution", showSolution ? puzzle.words.map((word) => `${word.display} ${place(word.path[0])}>${place(word.path[word.path.length - 1])}`).join(", ") : "hidden"],
    ["validator", `${check.text}, ${check.ms.toFixed(2)} ms`],
    ["generation", `${generationMs.toFixed(1)} ms, try ${puzzle.metadata.attempts}, ${puzzle.metadata.solverNodes} nodes`],
  ];

  return (
    <aside className="w-full rounded-xl text-xs font-mono p-3" style={{ background: "#1f1b2e", color: "#e8e3ff" }} data-testid="wend-debug">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="font-bold" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? "▾" : "▸"} debug
        </button>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showSolution}
            onChange={(event) => {
              onToggleSolution(event.target.checked);
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
