"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameClock } from "@/shared/hooks/use-game-clock";
import { playSound } from "@/shared/platform/audio";
import { vibrate } from "@/shared/platform/haptics";
import type { FinishSummary } from "@/shared/platform/results";
import { loadBoard, saveBoard } from "@/shared/storage/progress";
import type { Settings } from "@/shared/storage/settings";
import { IDLE_STATUS, type StatusMessage } from "@/shared/ui/status-line";
import { type GameState, canUndo, createGame, isLocked, placeRegion, previewRect, recordHint, removeRegionAt, resetGame, revealStep, undo as undoAction } from "../engine/game/state";
import { type Hint, getHint } from "../engine/hints/hint";
import type { CellCoordinate, PuzzleShape, Rect, Region } from "../engine/types";
import { fromSnapshot, toSnapshot } from "../storage/progress";

/** What the hook needs from a puzzle. The tutorial passes a hand-built board without generator metadata. */
export type PlayablePuzzle = PuzzleShape & { id: string; seed: string; solution?: readonly Region[] };

/** Pause between two pieces while a solution is revealed. */
const REVEAL_STEP_MS = 230;
/** A wrong patch stays flagged this long before a hint takes it off the board. */
const WRONG_PATCH_MS = 750;

type Options = {
  puzzle: PlayablePuzzle;
  settings: Settings;
  /** Persist progress under the puzzle id. The tutorial turns this off. */
  persist?: boolean;
};

const summarize = (state: GameState, elapsedMs: number): FinishSummary => ({
  elapsedMs,
  hintsUsed: state.hintsUsed,
  mistakes: state.redraws,
  moves: state.moves,
  revealed: state.revealed,
});

/**
 * Glue between the pure engine and React. The engine decides every rule. This
 * hook adds what needs a browser: the clock, storage, sound and vibration.
 * Mount it with `key={puzzle.id}` so a new puzzle starts from a clean slate.
 */
export function usePatchesGame({ puzzle, settings, persist = true }: Options) {
  const [game, setGame] = useState<GameState>(() => createGame(puzzle.id));
  const [ready, setReady] = useState(!persist);
  const [hint, setHint] = useState<Hint | null>(null);
  const [status, setStatus] = useState<StatusMessage>(IDLE_STATUS);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [endedNow, setEndedNow] = useState(false);
  /** Regions the game placed itself (hint or reveal). They appear cell by cell. */
  const [tweenIds, setTweenIds] = useState<ReadonlySet<string>>(new Set());
  const clock = useGameClock();

  // Mirror of state for event handlers, so actions read the latest board without re-subscribing.
  const gameRef = useRef(game);
  const busyRef = useRef(false);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const { clockRef, begin: beginClock, finish: finishClock, restore: restoreClock } = clock;

  const save = useCallback(() => {
    if (persist) void saveBoard("patches", puzzle.id, toSnapshot(gameRef.current, puzzle.seed, clockRef.current));
  }, [clockRef, persist, puzzle.id, puzzle.seed]);

  const commit = useCallback(
    (next: GameState) => {
      gameRef.current = next;
      setGame(next);
      save();
    },
    [save],
  );

  const feedback = useCallback((name: "place" | "remove" | "invalid" | "hint" | "complete" | "reveal") => {
    playSound(name, settingsRef.current.sound);
    if (name !== "reveal") vibrate(name, settingsRef.current.haptics);
  }, []);

  /** Ends the puzzle: stops the clock, saves, and hands the summary to the result flow. */
  const end = useCallback(
    (state: GameState) => {
      const elapsedMs = finishClock();
      save();
      setEndedNow(true);
      setSummary(summarize(state, elapsedMs));
      setStatus({ kind: "success", text: state.revealed ? "Solution revealed." : "Solved. Every cell is covered." });
      feedback("complete");
    },
    [feedback, finishClock, save],
  );

  /** The player is looking at the board: the clock starts, once, and the start instant is saved right away. */
  const begin = useCallback(() => {
    if (gameRef.current.status === "solved") return;
    if (beginClock()) save();
  }, [beginClock, save]);

  const runReveal = useCallback(() => {
    if (!puzzle.solution) return;
    const solution = puzzle.solution;
    busyRef.current = true;
    setHint(null);
    setStatus({ kind: "info", text: "Revealing the solution." });
    const tick = () => {
      const step = revealStep(solution, gameRef.current);
      if (step.change?.type === "place") {
        const placedId = step.change.region.id;
        setTweenIds((ids) => new Set(ids).add(placedId));
        feedback("reveal");
      }
      commit(step.state);
      if (step.state.status === "solved") {
        busyRef.current = false;
        end(step.state);
      } else {
        window.setTimeout(tick, REVEAL_STEP_MS);
      }
    };
    tick();
  }, [commit, end, feedback, puzzle.solution]);

  // Restore saved progress.
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    void loadBoard("patches", puzzle.id).then((snapshot) => {
      if (cancelled) return;
      const restored = fromSnapshot(puzzle, snapshot);
      if (restored) {
        gameRef.current = restored.state;
        setGame(restored.state);
        restoreClock(restored.clock);
        if (restored.state.status === "solved") setSummary(summarize(restored.state, restored.clock.finishedMs ?? 0));
        // A reload in the middle of a reveal carries on from the saved board.
        else if (restored.state.revealed) runReveal();
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Runs once per puzzle. runReveal and restoreClock are stable for the puzzle's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, puzzle]);

  const place = useCallback(
    (rect: Rect) => {
      if (busyRef.current) return;
      const result = placeRegion(puzzle, gameRef.current, rect);
      if (!result.ok) {
        if (result.errors.length === 0) return;
        setStatus({ kind: "invalid", text: result.errors[0].message });
        setShakeSignal((signal) => signal + 1);
        feedback("invalid");
        return;
      }
      setHint(null);
      setTweenIds((ids) => {
        if (!ids.has(result.region.id)) return ids;
        const next = new Set(ids);
        next.delete(result.region.id);
        return next;
      });
      commit(result.state);
      if (result.solved) {
        end(result.state);
      } else {
        const verb = result.replaced ? "Redrew the patch as" : "Placed a";
        setStatus({ kind: "info", text: `${verb} ${result.region.width} by ${result.region.height}${result.replaced ? "." : " patch."}` });
        feedback("place");
      }
    },
    [commit, end, feedback, puzzle],
  );

  const removeAt = useCallback(
    (cell: CellCoordinate) => {
      if (busyRef.current) return;
      const next = removeRegionAt(gameRef.current, cell);
      if (next === gameRef.current) return;
      setHint(null);
      commit(next);
      setStatus({ kind: "info", text: "Patch removed." });
      feedback("remove");
    },
    [commit, feedback],
  );

  const undo = useCallback(() => {
    if (busyRef.current) return;
    const next = undoAction(gameRef.current);
    if (next === gameRef.current) return;
    setHint(null);
    commit(next);
    setStatus({ kind: "info", text: "Last move undone." });
    feedback("remove");
  }, [commit, feedback]);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    const next = resetGame(gameRef.current);
    if (next === gameRef.current || gameRef.current.regions.length === 0) return;
    setHint(null);
    commit(next);
    setStatus({ kind: "info", text: "Board cleared. The clock keeps running." });
    feedback("remove");
  }, [commit, feedback]);

  /**
   * A hint acts. If a placed patch cannot be part of the solution, the hint
   * flags it and takes it off. Otherwise it places the next patch the solver
   * can prove, cell by cell, and says why that patch is forced.
   */
  const requestHint = useCallback(() => {
    if (busyRef.current || isLocked(gameRef.current)) return;
    const next = getHint(puzzle, gameRef.current.regions);
    if (next.kind === "complete") return;
    commit(recordHint(gameRef.current));
    setStatus({ kind: "hint", text: next.message });
    feedback("hint");

    if (next.kind === "wrong-region") {
      busyRef.current = true;
      setHint(next);
      window.setTimeout(() => {
        busyRef.current = false;
        setHint(null);
        commit(removeRegionAt(gameRef.current, next.cells[0]));
        feedback("remove");
      }, WRONG_PATCH_MS);
      return;
    }

    const result = placeRegion(puzzle, gameRef.current, next.rect);
    if (!result.ok) return;
    setHint(null);
    setTweenIds((ids) => new Set(ids).add(result.region.id));
    commit(result.state);
    if (result.solved) end(result.state);
  }, [commit, end, feedback, puzzle]);

  const reveal = useCallback(() => {
    if (busyRef.current || isLocked(gameRef.current)) return;
    runReveal();
  }, [runReveal]);

  /** The player pressed an empty cell and dragged. Drawing only starts on a clue. */
  const misstart = useCallback(() => {
    if (isLocked(gameRef.current)) return;
    setStatus({ kind: "info", text: "Start on a clue: press a cell with a number or a shape, then drag outward." });
  }, []);

  const previewStatus = useCallback((rect: Rect) => previewRect(puzzle, gameRef.current, rect).status, [puzzle]);

  return {
    game,
    ready,
    locked: isLocked(game),
    hint,
    status,
    shakeSignal,
    tweenIds,
    elapsed: clock.elapsed,
    summary,
    endedNow,
    hintsUsed: game.hintsUsed,
    canUndo: canUndo(game),
    canReset: !isLocked(game) && game.regions.length > 0,
    begin,
    place,
    removeAt,
    undo,
    reset,
    requestHint,
    reveal,
    misstart,
    previewStatus,
  };
}
