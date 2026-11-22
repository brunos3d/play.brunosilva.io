"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameClock } from "@/shared/hooks/use-game-clock";
import { type SoundName, playSound } from "@/shared/platform/audio";
import { type HapticPattern, vibrate } from "@/shared/platform/haptics";
import type { FinishSummary } from "@/shared/platform/results";
import { loadBoard, saveBoard } from "@/shared/storage/progress";
import type { Settings } from "@/shared/storage/settings";
import { IDLE_STATUS, type StatusMessage } from "@/shared/ui/status-line";
import {
  EMPTY,
  MARK,
  QUEEN,
  type QueensState,
  canUndoQueens,
  clearCell,
  commitAction,
  createQueensGame,
  cycleCell,
  isQueensLocked,
  paintCell,
  placeQueenAt,
  queensOf,
  recordQueensHint,
  resetQueens,
  revealQueensStep,
  undoQueens,
} from "../engine/game/state";
import { buildTopology } from "../engine/grid";
import { type UnitNamer, defaultUnitName, getQueensHint } from "../engine/hint";
import type { MoveError } from "../engine/rules";
import type { QueensShape } from "../engine/types";
import { fromQueensSnapshot, toQueensSnapshot } from "../storage/progress";

export type PlayableQueens = QueensShape & { id: string; seed: string; solution: readonly number[] };

/** Pause between two queens while the game plays the solution itself. */
const REVEAL_STEP_MS = 150;
/** A wrong queen or a wrong X stays flagged this long before a hint takes it off. */
const WRONG_MS = 750;
/** How long a hint shows its reason on the board before it acts. */
const HINT_ACT_MS = 450;
/** How long a refused cell and the queen that refuses it stay hatched. */
const REFUSED_MS = 700;

type Options = {
  puzzle: PlayableQueens;
  settings: Settings;
  persist?: boolean;
  /** Names regions in hint sentences. The board passes one that uses the region's colour. */
  nameUnit?: UnitNamer;
};

type Gesture = { marksBefore: readonly number[]; start: number; mode: "mark" | "erase" | null; moved: boolean };

const summarize = (state: QueensState, elapsedMs: number): FinishSummary => ({
  elapsedMs,
  hintsUsed: state.hintsUsed,
  mistakes: state.takebacks,
  moves: state.moves,
  revealed: state.revealed,
});

/**
 * Glue between the pure Queens engine and React: the clock, storage, sound and
 * the gesture that turns taps and drags into marks. Mount it with
 * `key={puzzle.id}` so a new puzzle starts from a clean slate.
 */
export function useQueensGame({ puzzle, settings, persist = true, nameUnit = defaultUnitName }: Options) {
  const topology = useMemo(() => buildTopology(puzzle), [puzzle]);
  const [game, setGame] = useState<QueensState>(() => createQueensGame(puzzle.id, puzzle.size * puzzle.size));
  const [ready, setReady] = useState(!persist);
  const [status, setStatus] = useState<StatusMessage>(IDLE_STATUS);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [refused, setRefused] = useState<{ cell: number; with: number } | null>(null);
  const [wrongCells, setWrongCells] = useState<readonly number[]>([]);
  const [hintCells, setHintCells] = useState<readonly number[]>([]);
  const [hintTargets, setHintTargets] = useState<readonly number[]>([]);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [endedNow, setEndedNow] = useState(false);
  const clock = useGameClock();

  // Sources of truth for the handlers. State only drives what is drawn.
  const gameRef = useRef(game);
  const gestureRef = useRef<Gesture | null>(null);
  const busyRef = useRef(false);
  const lastRefusedRef = useRef<number | null>(null);
  const refusedTimer = useRef(0);
  const settingsRef = useRef(settings);
  const nameRef = useRef(nameUnit);
  useEffect(() => {
    settingsRef.current = settings;
    nameRef.current = nameUnit;
  }, [settings, nameUnit]);

  const { clockRef, begin: beginClock, finish: finishClock, restore: restoreClock } = clock;

  const save = useCallback(() => {
    if (persist) void saveBoard("queens", puzzle.id, toQueensSnapshot(gameRef.current, puzzle.seed, clockRef.current));
  }, [clockRef, persist, puzzle.id, puzzle.seed]);

  const show = useCallback((next: QueensState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const feedback = useCallback((sound: SoundName, haptic: HapticPattern | null, pitch = 1) => {
    playSound(sound, settingsRef.current.sound, pitch);
    if (haptic) vibrate(haptic, settingsRef.current.haptics);
  }, []);

  const clearHint = useCallback(() => {
    setHintCells([]);
    setHintTargets([]);
  }, []);

  const end = useCallback(
    (state: QueensState) => {
      const elapsedMs = finishClock();
      save();
      clearHint();
      setEndedNow(true);
      setSummary(summarize(state, elapsedMs));
      setStatus({ kind: "success", text: state.revealed ? "Solution revealed." : "Solved. Every queen has its place." });
      feedback("complete", "complete");
    },
    [clearHint, feedback, finishClock, save],
  );

  const begin = useCallback(() => {
    if (gameRef.current.status === "solved") return;
    if (beginClock()) save();
  }, [beginClock, save]);

  const refuse = useCallback(
    (cell: number, error: MoveError) => {
      lastRefusedRef.current = cell;
      setStatus({ kind: "invalid", text: `${error.message} Tap again to clear the X.` });
      setShakeSignal((signal) => signal + 1);
      setRefused({ cell, with: error.with });
      window.clearTimeout(refusedTimer.current);
      refusedTimer.current = window.setTimeout(() => setRefused(null), REFUSED_MS);
      feedback("invalid", "invalid");
    },
    [feedback],
  );

  /** Closes an action: counts it, saves, and ends the puzzle if the last queen went on. */
  const commit = useCallback(
    (marksBefore: readonly number[]) => {
      const next = commitAction(gameRef.current, marksBefore);
      if (next === gameRef.current) return;
      show(next);
      save();
      if (next.status === "solved") end(next);
    },
    [end, save, show],
  );

  /** One tap on a cell: empty, X, queen, empty. */
  const tap = useCallback(
    (cell: number) => {
      const before = gameRef.current;
      const skipQueen = lastRefusedRef.current === cell;
      const result = cycleCell(topology, before, cell, skipQueen);
      if (!result.ok) {
        if (result.error) refuse(cell, result.error);
        return;
      }
      lastRefusedRef.current = null;
      clearHint();
      show(result.state);
      const queens = queensOf(result.state.marks).length;
      if (result.event === "mark") feedback("step", "step");
      else if (result.event === "clear") feedback(before.marks[cell] === QUEEN ? "remove" : "back", before.marks[cell] === QUEEN ? "remove" : null);
      else if (result.event === "queen") feedback("place", "place", 1 + (queens / topology.size) * 0.5);
      setStatus(IDLE_STATUS);
      commit(before.marks);
    },
    [clearHint, commit, feedback, refuse, show, topology],
  );

  const press = useCallback((cell: number) => {
    if (busyRef.current || isQueensLocked(gameRef.current)) return;
    const value = gameRef.current.marks[cell];
    gestureRef.current = { marksBefore: gameRef.current.marks, start: cell, mode: value === EMPTY ? "mark" : value === MARK ? "erase" : null, moved: false };
  }, []);

  const paint = useCallback(
    (cell: number, mode: "mark" | "erase") => {
      const next = paintCell(gameRef.current, cell, mode);
      if (next === gameRef.current) return;
      show(next);
      feedback(mode === "mark" ? "step" : "back", mode === "mark" ? "step" : null);
    },
    [feedback, show],
  );

  /** The pointer entered another cell with the button down: the tap became a drag. */
  const drag = useCallback(
    (cell: number) => {
      const gesture = gestureRef.current;
      if (!gesture || busyRef.current) return;
      if (!gesture.moved) {
        gesture.moved = true;
        lastRefusedRef.current = null;
        clearHint();
        if (gesture.mode) paint(gesture.start, gesture.mode);
      }
      if (gesture.mode) paint(cell, gesture.mode);
    },
    [clearHint, paint],
  );

  const release = useCallback(() => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || busyRef.current) return;
    if (!gesture.moved) {
      tap(gesture.start);
      return;
    }
    setStatus(IDLE_STATUS);
    commit(gesture.marksBefore);
  }, [commit, tap]);

  /** Enter or Space on the keyboard cursor. */
  const keyCycle = useCallback(
    (cell: number) => {
      if (busyRef.current || isQueensLocked(gameRef.current)) return;
      tap(cell);
    },
    [tap],
  );

  /** Delete or Backspace on the keyboard cursor. */
  const keyClear = useCallback(
    (cell: number) => {
      if (busyRef.current || isQueensLocked(gameRef.current)) return;
      const before = gameRef.current;
      const next = clearCell(before, cell);
      if (next === before) return;
      lastRefusedRef.current = null;
      clearHint();
      show(next);
      feedback(before.marks[cell] === QUEEN ? "remove" : "back", before.marks[cell] === QUEEN ? "remove" : null);
      setStatus(IDLE_STATUS);
      commit(before.marks);
    },
    [clearHint, commit, feedback, show],
  );

  const runReveal = useCallback(() => {
    busyRef.current = true;
    clearHint();
    setWrongCells([]);
    setStatus({ kind: "info", text: "Revealing the solution." });
    const tick = () => {
      if (gameRef.current.status === "solved") {
        busyRef.current = false;
        end(gameRef.current);
        return;
      }
      const next = revealQueensStep(topology, puzzle.solution, gameRef.current);
      const grew = queensOf(next.marks).length > queensOf(gameRef.current.marks).length;
      show(next);
      if (grew) feedback("reveal", null, 1 + queensOf(next.marks).length / topology.size);
      window.setTimeout(tick, REVEAL_STEP_MS);
    };
    tick();
  }, [clearHint, end, feedback, puzzle.solution, show, topology]);

  // Restore saved progress.
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    void loadBoard("queens", puzzle.id).then((snapshot) => {
      if (cancelled) return;
      const restored = fromQueensSnapshot(puzzle.id, topology, snapshot);
      if (restored) {
        gameRef.current = restored.state;
        setGame(restored.state);
        restoreClock(restored.clock);
        if (restored.state.status === "solved") setSummary(summarize(restored.state, restored.clock.finishedMs ?? 0));
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

  const undo = useCallback(() => {
    if (busyRef.current) return;
    const next = undoQueens(gameRef.current);
    if (next === gameRef.current) return;
    lastRefusedRef.current = null;
    clearHint();
    show(next);
    save();
    setStatus({ kind: "info", text: "Last move undone." });
    feedback("back", "remove");
  }, [clearHint, feedback, save, show]);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    const next = resetQueens(gameRef.current);
    if (next === gameRef.current) return;
    lastRefusedRef.current = null;
    clearHint();
    show(next);
    save();
    setStatus({ kind: "info", text: "Board cleared. The clock keeps running." });
    feedback("remove", "remove");
  }, [clearHint, feedback, save, show]);

  /**
   * A hint acts. A wrong queen or a wrong X is flagged and taken off first.
   * Otherwise the game plays the next deduction step itself: it places the
   * queen, or marks the cells the reasoning rules out, and says why.
   */
  const requestHint = useCallback(() => {
    if (busyRef.current || isQueensLocked(gameRef.current)) return;
    const hint = getQueensHint(topology, puzzle.solution, gameRef.current.marks, nameRef.current);
    if (hint.kind === "complete") return;
    const marksBefore = gameRef.current.marks;
    lastRefusedRef.current = null;
    show(recordQueensHint(gameRef.current));
    setStatus({ kind: "hint", text: hint.message });
    feedback("hint", "hint");
    busyRef.current = true;

    if (hint.kind === "wrong-queen" || hint.kind === "wrong-mark") {
      clearHint();
      setWrongCells([hint.cell]);
      window.setTimeout(() => {
        busyRef.current = false;
        setWrongCells([]);
        show(clearCell(gameRef.current, hint.cell));
        feedback("back", "remove");
        commit(marksBefore);
        // The hint counter moved even if the board did not, so the save is unconditional.
        save();
      }, WRONG_MS);
      return;
    }

    setHintCells(hint.highlight);
    setHintTargets(hint.kind === "place" ? [hint.cell] : hint.cells);
    window.setTimeout(() => {
      busyRef.current = false;
      if (hint.kind === "place") {
        const result = placeQueenAt(topology, gameRef.current, hint.cell);
        if (result.ok) {
          show(result.state);
          feedback("place", "place");
        }
      } else {
        let next = gameRef.current;
        for (const cell of hint.cells) next = paintCell(next, cell, "mark");
        show(next);
        feedback("step", "step");
      }
      commit(marksBefore);
      save();
    }, HINT_ACT_MS);
  }, [clearHint, commit, feedback, puzzle.solution, save, show, topology]);

  const reveal = useCallback(() => {
    if (busyRef.current || isQueensLocked(gameRef.current)) return;
    runReveal();
  }, [runReveal]);

  return {
    topology,
    game,
    ready,
    locked: isQueensLocked(game),
    status,
    shakeSignal,
    refused,
    wrongCells,
    hintCells,
    hintTargets,
    elapsed: clock.elapsed,
    summary,
    endedNow,
    hintsUsed: game.hintsUsed,
    canUndo: canUndoQueens(game),
    canReset: !isQueensLocked(game) && game.marks.some((value) => value !== EMPTY),
    begin,
    press,
    drag,
    release,
    keyCycle,
    keyClear,
    undo,
    reset,
    requestHint,
    reveal,
  };
}
