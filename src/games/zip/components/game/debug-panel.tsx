"use client";

import { useState } from "react";
import { solveZip } from "../../engine/solver";
import type { ZipPuzzle } from "../../engine/types";

type Props = { puzzle: ZipPuzzle; generationMs: number; showSolution: boolean; onToggleSolution: (value: boolean) => void };

/** Development only. The game container never imports this file in production builds. */
export default function ZipDebugPanel({ puzzle, generationMs, showSolution, onToggleSolution }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [solver] = useState(() => {
    const started = performance.now();
    const result = solveZip(puzzle, { maxSolutions: 2 });
    return { ms: performance.now() - started, solutions: result.solutionCount, nodes: result.nodes };
  });

  const rows: [string, string | number][] = [
    ["seed", puzzle.seed],
    ["puzzle id", puzzle.id],
    ["generator version", puzzle.version],
    ["board", `${puzzle.width}x${puzzle.height}`],
    ["difficulty", puzzle.difficulty],
    ["numbers", `${puzzle.metadata.checkpointCount} (${puzzle.metadata.hiddenCount} hidden)`],
    ["walls", puzzle.metadata.wallCount],
    ["blocked", puzzle.metadata.blockedCount],
    ["theme", `${puzzle.metadata.theme.figure} / ${puzzle.metadata.theme.path}${puzzle.metadata.theme.symmetric ? " (symmetric)" : ""}`],
    ["trap score", `${puzzle.metadata.trapScore} (${puzzle.metadata.deepTraps} deep)`],
    ["solutions", solver.solutions],
    ["solver", `${solver.ms.toFixed(2)} ms, ${solver.nodes} nodes`],
    ["generation", `${generationMs.toFixed(1)} ms, attempt ${puzzle.metadata.attempts}, ${puzzle.metadata.solverNodes} nodes`],
  ];

  return (
    <aside className="w-full rounded-xl text-xs font-mono p-3" style={{ background: "#1f1b2e", color: "#e8e3ff" }} data-testid="zip-debug">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="font-bold" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? "▾" : "▸"} debug
        </button>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showSolution} onChange={(event) => onToggleSolution(event.target.checked)} /> show solution
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
