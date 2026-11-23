"use client";

import { useState } from "react";
import { TERMO_MODE_NAMES } from "../../engine/config";
import { validateTermoPuzzle } from "../../engine/generator";
import type { TermoPuzzle } from "../../engine/types";
import { displayWord, knownWordCount } from "../../engine/words";

type Props = { puzzle: TermoPuzzle; generationMs: number; showSolution: boolean; onToggleSolution: (value: boolean) => void };

/** Development only. The game container never imports this file in production builds. */
export default function TermoDebugPanel({ puzzle, generationMs, showSolution, onToggleSolution }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [check] = useState(() => {
    const started = performance.now();
    const result = validateTermoPuzzle(puzzle);
    return { ms: performance.now() - started, text: result.ok ? "ok" : result.problems.join(" "), words: knownWordCount() };
  });

  const rows: [string, string | number][] = [
    ["seed", puzzle.seed],
    ["puzzle id", puzzle.id],
    ["generator version", puzzle.version],
    ["mode", `${TERMO_MODE_NAMES[puzzle.difficulty]} (tier ${puzzle.difficulty}): ${puzzle.answers.length} word(s), ${puzzle.maxGuesses} guesses`],
    ["pool", `${puzzle.metadata.poolSize} answers, ${check.words} accepted guesses`],
    ["answers", showSolution ? puzzle.answers.map((word, index) => `${displayWord(word)} (#${puzzle.metadata.ranks[index] + 1})`).join(", ") : "hidden"],
    ["validator", `${check.text}, ${check.ms.toFixed(2)} ms`],
    ["generation", `${generationMs.toFixed(1)} ms`],
  ];

  return (
    <aside className="w-full rounded-xl text-xs font-mono p-3" style={{ background: "#1f1b2e", color: "#e8e3ff" }} data-testid="termo-debug">
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
