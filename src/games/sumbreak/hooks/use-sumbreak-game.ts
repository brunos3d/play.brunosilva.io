"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameClock } from "@/shared/hooks/use-game-clock";
import { type SoundName, playSound } from "@/shared/platform/audio";
import { type HapticPattern, vibrate } from "@/shared/platform/haptics";
import type { FinishSummary } from "@/shared/platform/results";
import { loadBoard, saveBoard } from "@/shared/storage/progress";
import type { Settings } from "@/shared/storage/settings";
import { IDLE_STATUS, type StatusMessage } from "@/shared/ui/status-line";
import { type SumbreakState, beginSumbreakReveal, canUndoSumbreak, createSumbreakGame, isSumbreakLocked, mergeTiles, playMerge, recordSumbreakHint, resetSumbreak, rewindTo, tilesOnBoard, undoSumbreak } from "../engine/game/state";
import { getSumbreakHint } from "../engine/hint";
import { isStuck } from "../engine/rules";
import { SumbreakSolver } from "../engine/solver";
import type { Merge, SumbreakShape } from "../engine/types";
import { fromSumbreakSnapshot, toSumbreakSnapshot } from "../storage/progress";

export type PlayableSumbreak = SumbreakShape & { id: string; seed: string };

/** A hinted pair pulses this long before the game merges it. */
const HINT_MS = 750;
/** A dead end is named this long before the board goes back. */
const DEAD_END_MS = 900;
/** Pause between merges while the solution plays itself. */
const REVEAL_STEP_MS = 420;
/** How long a refused cell stays marked. */
const REFUSED_MS = 450;

const STUCK_TEXT = "No merges left. Undo, or ask for a hint to go back to the last position that can be finished.";

type Options = { puzzle: PlayableSumbreak; settings: Settings; persist?: boolean };

const summarize = (state: SumbreakState, elapsedMs: number): FinishSummary => ({ elapsedMs, hintsUsed: state.hintsUsed, mistakes: state.mistakes, moves: state.moves, revealed: state.revealed });

/**
 * Glue between the pure Sumbreak engine and React: the clock, storage, sound
 * and the pauses of hints and reveals. Mount it with `key={puzzle.id}` so a new
 * puzzle starts from a clean slate.
 */
export function useSumbreakGame({ puzzle, settings, persist = true }: Options) {
  const [game, setGame] = useState<SumbreakState>(() => createSumbreakGame(puzzle.id, puzzle));
  const [ready, setReady] = useState(!persist);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(IDLE_STATUS);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [refusedCell, setRefusedCell] = useState<number | null>(null);
  /** The pair a hint is pointing at. */
  const [hinted, setHinted] = useState<Merge | null>(null);
  /** The last merge played forwards. The board uses it to slide the tile that left into the one that stayed. */
  const [lastMerge, setLastMerge] = useState<Merge | null>(null);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [endedNow, setEndedNow] = useState(false);
  const clock = useGameClock();

  // Sources of truth for the handlers. State only drives what is drawn.
  const gameRef = useRef(game);
  const busyRef = useRef(false);
  const timers = useRef(new Set<number>());
  const refusedTimer = useRef(0);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, []);

  const { clockRef, begin: beginClock, finish: finishClock, restore: restoreClock } = clock;

  const later = useCallback((ms: number, run: () => void) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, ms);
    timers.current.add(timer);
  }, []);

  const setBusyNow = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  }, []);

  const save = useCallback(() => {
    if (persist) void saveBoard("sumbreak", puzzle.id, toSumbreakSnapshot(gameRef.current, puzzle.seed, clockRef.current));
  }, [clockRef, persist, puzzle.id, puzzle.seed]);

  const show = useCallback((next: SumbreakState, merge: Merge | null) => {
    gameRef.current = next;
    setGame(next);
    setLastMerge(merge);
  }, []);

  const feedback = useCallback((sound: SoundName, haptic: HapticPattern | null, pitch = 1) => {
    playSound(sound, settingsRef.current.sound, pitch);
    if (haptic) vibrate(haptic, settingsRef.current.haptics);
  }, []);

  /** A merge rings higher the bigger the tile it makes: one octave from the smallest tile to the final one. */
  const mergeSound = useCallback(
    (sound: SoundName, haptic: HapticPattern | null, value: number) => {
      const total = puzzle.cells.reduce((sum, cell) => sum + cell, 0);
      feedback(sound, haptic, 1 + Math.log2(Math.max(2, value)) / Math.max(1, Math.log2(total)));
    },
    [feedback, puzzle.cells],
  );

  const end = useCallback(
    (state: SumbreakState) => {
      const elapsedMs = finishClock();
      save();
      setBusyNow(false);
      setHinted(null);
      setEndedNow(true);
      setSummary(summarize(state, elapsedMs));
      setStatus({ kind: "success", text: state.revealed ? "Solution revealed." : "Solved. One tile left." });
      feedback("complete", "complete");
    },
    [feedback, finishClock, save, setBusyNow],
  );

  const begin = useCallback(() => {
    if (gameRef.current.status === "solved") return;
    if (beginClock()) save();
  }, [beginClock, save]);

  const refuse = useCallback(
    (cell: number, message: string) => {
      setStatus({ kind: "invalid", text: message });
      setShakeSignal((signal) => signal + 1);
      setRefusedCell(cell);
      window.clearTimeout(refusedTimer.current);
      refusedTimer.current = window.setTimeout(() => setRefusedCell(null), REFUSED_MS);
      feedback("invalid", "invalid");
    },
    [feedback],
  );

  /** The player drops one tile onto another. */
  const merge = useCallback(
    (from: number, to: number) => {
      if (busyRef.current || isSumbreakLocked(gameRef.current)) return;
      const result = mergeTiles(puzzle, gameRef.current, { from, to });
      if (!result.ok) {
        if (result.error) refuse(to, result.error.message);
        return;
      }
      setHinted(null);
      show(result.state, { from, to });
      save();
      mergeSound("place", "place", result.state.cells[to]);
      if (result.solved) {
        end(result.state);
        return;
      }
      if (isStuck(puzzle.size, result.state.cells)) {
        setStatus({ kind: "invalid", text: STUCK_TEXT });
        feedback("invalid", "invalid");
      } else {
        setStatus(IDLE_STATUS);
      }
    },
    [end, feedback, mergeSound, puzzle, refuse, save, show],
  );

  const runReveal = useCallback(() => {
    setBusyNow(true);
    setHinted(null);
    setStatus({ kind: "info", text: "Revealing the solution." });
    // The solution starts from a board that can be finished, so a broken one goes back first.
    const state = gameRef.current;
    if (state.brokenAt !== null) show(rewindTo(puzzle, state, state.brokenAt), null);
    const solution = new SumbreakSolver(puzzle.size).solve(gameRef.current.cells) ?? [];
    let index = 0;
    const step = () => {
      const next = solution[index++];
      if (next === undefined || gameRef.current.status === "solved") {
        end(gameRef.current);
        return;
      }
      const after = playMerge(puzzle, gameRef.current, next);
      show(after, next);
      mergeSound("reveal", null, after.cells[next.to]);
      later(REVEAL_STEP_MS, step);
    };
    later(REVEAL_STEP_MS, step);
  }, [end, later, mergeSound, puzzle, setBusyNow, show]);

  // Restore saved progress.
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    void loadBoard("sumbreak", puzzle.id).then((snapshot) => {
      if (cancelled) return;
      const restored = fromSumbreakSnapshot(puzzle.id, puzzle, snapshot);
      if (restored) {
        gameRef.current = restored.state;
        setGame(restored.state);
        restoreClock(restored.clock);
        if (restored.state.status === "solved") setSummary(summarize(restored.state, restored.clock.finishedMs ?? 0));
        else if (restored.state.revealed) runReveal();
        else if (isStuck(puzzle.size, restored.state.cells)) setStatus({ kind: "invalid", text: STUCK_TEXT });
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Runs once per puzzle. runReveal and restoreClock are stable for the puzzle's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, puzzle]);

  const undo = useCallback(() => {
    if (busyRef.current) return;
    const next = undoSumbreak(puzzle, gameRef.current);
    if (next === gameRef.current) return;
    setHinted(null);
    show(next, null);
    save();
    setStatus({ kind: "info", text: "Last merge undone." });
    feedback("back", "remove");
  }, [feedback, puzzle, save, show]);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    const next = resetSumbreak(puzzle, gameRef.current);
    if (next === gameRef.current) return;
    setHinted(null);
    show(next, null);
    save();
    setStatus({ kind: "info", text: "Board reset. The clock keeps running." });
    feedback("remove", "remove");
  }, [feedback, puzzle, save, show]);

  /**
   * A hint acts. On a board that can no longer be finished it says what went
   * wrong and goes back to the last good position. Otherwise it points at the
   * next merge of a solution and plays it.
   */
  const requestHint = useCallback(() => {
    if (busyRef.current || isSumbreakLocked(gameRef.current)) return;
    const hint = getSumbreakHint(puzzle, gameRef.current);
    if (hint.kind === "complete") return;
    show(recordSumbreakHint(gameRef.current), null);
    setStatus({ kind: "hint", text: hint.message });
    feedback("hint", "hint");
    setBusyNow(true);

    if (hint.kind === "dead-end") {
      later(DEAD_END_MS, () => {
        show(rewindTo(puzzle, gameRef.current, hint.keep), null);
        feedback("back", "remove");
        save();
        setBusyNow(false);
      });
      return;
    }

    setHinted(hint.merge);
    later(HINT_MS, () => {
      const next = playMerge(puzzle, gameRef.current, hint.merge);
      show(next, hint.merge);
      setHinted(null);
      mergeSound("place", "place", next.cells[hint.merge.to]);
      save();
      if (next.status === "solved") end(next);
      else setBusyNow(false);
    });
  }, [end, feedback, later, mergeSound, puzzle, save, setBusyNow, show]);

  const reveal = useCallback(() => {
    if (busyRef.current || isSumbreakLocked(gameRef.current)) return;
    show(beginSumbreakReveal(gameRef.current), null);
    save();
    runReveal();
  }, [runReveal, save, show]);

  const tiles = useMemo(() => tilesOnBoard(puzzle, game.history), [game.history, puzzle]);
  const stuck = game.status === "playing" && !game.revealed && isStuck(puzzle.size, game.cells);

  return {
    game,
    tiles,
    lastMerge,
    hinted,
    stuck,
    busy,
    ready,
    locked: isSumbreakLocked(game),
    status,
    shakeSignal,
    refusedCell,
    elapsed: clock.elapsed,
    summary,
    endedNow,
    hintsUsed: game.hintsUsed,
    canUndo: canUndoSumbreak(game) && !busy,
    canReset: canUndoSumbreak(game) && !busy,
    begin,
    merge,
    undo,
    reset,
    requestHint,
    reveal,
  };
}
