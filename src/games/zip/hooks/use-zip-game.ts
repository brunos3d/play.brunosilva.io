"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameClock } from "@/shared/hooks/use-game-clock";
import { type SoundName, playSound } from "@/shared/platform/audio";
import { type HapticPattern, vibrate } from "@/shared/platform/haptics";
import type { FinishSummary } from "@/shared/platform/results";
import { loadBoard, saveBoard } from "@/shared/storage/progress";
import type { Settings } from "@/shared/storage/settings";
import { IDLE_STATUS, type StatusMessage } from "@/shared/ui/status-line";
import { type ZipState, canUndoZip, commitGesture, createZipGame, isZipLocked, recordZipHint, resetZip, revealZipStep, stepTo, truncateTo, undoZip } from "../engine/game/state";
import { buildTopology } from "../engine/grid";
import { getZipHint } from "../engine/hint";
import { validatePath } from "../engine/rules";
import type { ZipShape } from "../engine/types";
import { fromZipSnapshot, toZipSnapshot } from "../storage/progress";

export type PlayableZip = ZipShape & { id: string; seed: string; solution: readonly number[] };

/** Pause between two cells while the game draws the path itself (hint or reveal). */
const AUTO_STEP_MS = 55;
/** A wrong stretch stays flagged this long before a hint cuts it off. */
const WRONG_TURN_MS = 750;
/** How long a refused cell stays marked. */
const REFUSED_MS = 450;
/** Dragging back onto one of the last few cells rewinds to it. Farther back needs a tap, so a stray touch cannot wipe the path. */
const REWIND_REACH = 3;

type Options = { puzzle: PlayableZip; settings: Settings; persist?: boolean };

const summarize = (state: ZipState, elapsedMs: number): FinishSummary => ({
  elapsedMs,
  hintsUsed: state.hintsUsed,
  mistakes: state.backtracks,
  moves: state.moves,
  revealed: state.revealed,
});

/**
 * Glue between the pure Zip engine and React: the clock, storage, sound and
 * the gesture that turns pointer cells into steps. Mount it with
 * `key={puzzle.id}` so a new puzzle starts from a clean slate.
 */
export function useZipGame({ puzzle, settings, persist = true }: Options) {
  const topology = useMemo(() => buildTopology(puzzle), [puzzle]);
  const [game, setGame] = useState<ZipState>(() => createZipGame(puzzle.id));
  const [ready, setReady] = useState(!persist);
  const [status, setStatus] = useState<StatusMessage>(IDLE_STATUS);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [refusedCell, setRefusedCell] = useState<number | null>(null);
  const [wrongCells, setWrongCells] = useState<readonly number[]>([]);
  const [missingCells, setMissingCells] = useState<readonly number[]>([]);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [endedNow, setEndedNow] = useState(false);
  const clock = useGameClock();

  // Sources of truth for the handlers. State only drives what is drawn.
  const gameRef = useRef(game);
  const gestureRef = useRef<{ pathBefore: readonly number[]; lastRefused: number | null } | null>(null);
  const busyRef = useRef(false);
  const refusedTimer = useRef(0);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const { clockRef, begin: beginClock, finish: finishClock, restore: restoreClock } = clock;

  const save = useCallback(() => {
    if (persist) void saveBoard("zip", puzzle.id, toZipSnapshot(gameRef.current, puzzle.seed, clockRef.current));
  }, [clockRef, persist, puzzle.id, puzzle.seed]);

  /** Updates the board. Saving is left to the end of a gesture, so a drag does not write on every cell. */
  const show = useCallback((next: ZipState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const feedback = useCallback((sound: SoundName, haptic: HapticPattern | null, pitch = 1) => {
    playSound(sound, settingsRef.current.sound, pitch);
    if (haptic) vibrate(haptic, settingsRef.current.haptics);
  }, []);

  const end = useCallback(
    (state: ZipState) => {
      const elapsedMs = finishClock();
      save();
      setMissingCells([]);
      setEndedNow(true);
      setSummary(summarize(state, elapsedMs));
      setStatus({ kind: "success", text: state.revealed ? "Solution revealed." : "Solved. One path through every cell." });
      feedback("complete", "complete");
    },
    [feedback, finishClock, save],
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

  /** One step of the head, with its sound. Returns false when the rules refused it. */
  const step = useCallback(
    (cell: number): boolean => {
      const result = stepTo(topology, gameRef.current, cell);
      if (!result.ok) {
        const gesture = gestureRef.current;
        // A finger resting on a forbidden cell fires many moves. Complain once per cell.
        if (result.error && gesture?.lastRefused !== cell) {
          if (gesture) gesture.lastRefused = cell;
          refuse(cell, result.error.message);
        }
        return false;
      }
      if (gestureRef.current) gestureRef.current.lastRefused = null;
      show(result.state);
      const progress = result.state.path.length / topology.cellCount;
      if (result.event === "back") feedback("back", null);
      else if (result.event === "checkpoint") feedback("checkpoint", "checkpoint", 1 + progress * 0.5);
      else if (result.event === "extend") feedback("step", "step", 1 + progress);
      return true;
    },
    [feedback, refuse, show, topology],
  );

  /**
   * Moves the head toward `cell`. A fast drag can skip cells, so a target in
   * the same row or column is reached by walking every cell in between, and a
   * diagonal neighbour by trying both corners. Walking stops at the first
   * refused step. Returns false when the target is out of reach of all that,
   * so the caller can decide whether that deserves a word.
   */
  const advanceToward = useCallback(
    (cell: number): boolean => {
      const path = gameRef.current.path;
      if (path.length === 0) {
        step(cell);
        return true;
      }
      const head = path[path.length - 1];
      if (cell === head) return true;

      const index = path.indexOf(cell);
      if (index >= 0) {
        if (path.length - 1 - index > REWIND_REACH) return true;
        show(truncateTo(gameRef.current, cell));
        feedback("back", null);
        return true;
      }

      const { width } = topology;
      const [headRow, headColumn, row, column] = [Math.floor(head / width), head % width, Math.floor(cell / width), cell % width];
      if (headRow === row || headColumn === column) {
        const stride = headRow === row ? Math.sign(column - headColumn) : Math.sign(row - headRow) * width;
        for (let next = head + stride; ; next += stride) {
          if (!step(next) || next === cell) break;
        }
        return true;
      }
      if (Math.abs(headRow - row) === 1 && Math.abs(headColumn - column) === 1) {
        const corners = [headRow * width + column, row * width + headColumn];
        const corner = corners.find((candidate) => stepTo(topology, gameRef.current, candidate).ok && candidate !== path[path.length - 2]);
        if (corner !== undefined && step(corner)) step(cell);
        return true;
      }
      return false;
    },
    [feedback, show, step, topology],
  );

  /** Closes a gesture: counts it, saves, and checks for the two endings a path can have. */
  const closeGesture = useCallback(() => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture) return;
    const next = commitGesture(gameRef.current, gesture.pathBefore);
    if (next === gameRef.current) return;
    show(next);
    save();
    if (next.status === "solved") {
      end(next);
      return;
    }
    const head = next.path[next.path.length - 1];
    if (head === topology.end) {
      const { uncovered } = validatePath(topology, next.path);
      setMissingCells(uncovered);
      setStatus({ kind: "invalid", text: `The path reached ${topology.lastNumber} with ${uncovered.length} ${uncovered.length === 1 ? "cell" : "cells"} still empty. Back up and cover them first.` });
    } else {
      setMissingCells([]);
      setStatus(IDLE_STATUS);
    }
  }, [end, save, show, topology]);

  const press = useCallback(
    (cell: number) => {
      if (busyRef.current || isZipLocked(gameRef.current)) return;
      gestureRef.current = { pathBefore: gameRef.current.path, lastRefused: null };
      const path = gameRef.current.path;
      const index = path.indexOf(cell);
      if (index >= 0 && index < path.length - 1) {
        // A press on the path cuts it there, however far back. The drag then continues from that cell.
        show(truncateTo(gameRef.current, cell));
        feedback("back", null);
        return;
      }
      // A deliberate tap on a cell the path cannot reach gets an answer. The same cell crossed
      // during a drag stays silent, or a fast diagonal swipe would buzz all the way.
      if (!advanceToward(cell)) step(cell);
    },
    [advanceToward, feedback, show, step],
  );

  const drag = useCallback(
    (cell: number) => {
      if (gestureRef.current && !busyRef.current) advanceToward(cell);
    },
    [advanceToward],
  );

  const keyStep = useCallback(
    (direction: "up" | "down" | "left" | "right" | "back") => {
      if (busyRef.current || isZipLocked(gameRef.current)) return;
      const path = gameRef.current.path;
      gestureRef.current = { pathBefore: path, lastRefused: null };
      if (path.length === 0) {
        step(topology.start);
      } else if (direction === "back") {
        if (path.length >= 2) step(path[path.length - 2]);
      } else {
        const head = path[path.length - 1];
        const { width, height } = topology;
        const [row, column] = [Math.floor(head / width), head % width];
        const target = { up: row > 0 ? head - width : -1, down: row < height - 1 ? head + width : -1, left: column > 0 ? head - 1 : -1, right: column < width - 1 ? head + 1 : -1 }[direction];
        if (target >= 0) step(target);
      }
      closeGesture();
    },
    [closeGesture, step, topology],
  );

  /** Draws cells one by one. Used by hints and by the reveal. */
  const autoDraw = useCallback(
    (nextState: () => ZipState | null, done: () => void) => {
      busyRef.current = true;
      const tick = () => {
        const next = nextState();
        if (!next) {
          busyRef.current = false;
          done();
          return;
        }
        const grew = next.path.length > gameRef.current.path.length;
        show(next);
        if (grew) feedback("reveal", null, 1 + next.path.length / topology.cellCount);
        window.setTimeout(tick, AUTO_STEP_MS);
      };
      tick();
    },
    [feedback, show, topology.cellCount],
  );

  const runReveal = useCallback(() => {
    setWrongCells([]);
    setMissingCells([]);
    setStatus({ kind: "info", text: "Revealing the solution." });
    autoDraw(
      () => (gameRef.current.status === "solved" ? null : revealZipStep(puzzle.solution, gameRef.current)),
      () => end(gameRef.current),
    );
  }, [autoDraw, end, puzzle.solution]);

  // Restore saved progress.
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    void loadBoard("zip", puzzle.id).then((snapshot) => {
      if (cancelled) return;
      const restored = fromZipSnapshot(puzzle.id, topology, snapshot);
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
    const next = undoZip(gameRef.current);
    if (next === gameRef.current) return;
    show(next);
    save();
    setMissingCells([]);
    setStatus({ kind: "info", text: "Last move undone." });
    feedback("back", "remove");
  }, [feedback, save, show]);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    const next = resetZip(gameRef.current);
    if (next === gameRef.current) return;
    show(next);
    save();
    setMissingCells([]);
    setStatus({ kind: "info", text: "Path cleared. The clock keeps running." });
    feedback("remove", "remove");
  }, [feedback, save, show]);

  /**
   * A hint acts. If the path left the solution, the wrong stretch is flagged
   * and cut off. Otherwise the game draws the path to the next number.
   */
  const requestHint = useCallback(() => {
    if (busyRef.current || isZipLocked(gameRef.current)) return;
    const hint = getZipHint(topology, puzzle.solution, gameRef.current.path);
    if (hint.kind === "complete") return;
    const pathBefore = gameRef.current.path;
    show(recordZipHint(gameRef.current));
    setMissingCells([]);
    setStatus({ kind: "hint", text: hint.message });
    feedback("hint", "hint");

    const settle = () => {
      const next = { ...gameRef.current, history: [...gameRef.current.history, pathBefore] };
      show(next);
      save();
      if (next.status === "solved") end(next);
    };

    if (hint.kind === "wrong-turn") {
      busyRef.current = true;
      setWrongCells(hint.wrongCells);
      window.setTimeout(() => {
        busyRef.current = false;
        setWrongCells([]);
        show({ ...gameRef.current, path: gameRef.current.path.slice(0, hint.keep) });
        feedback("back", "remove");
        settle();
      }, WRONG_TURN_MS);
      return;
    }

    const queue = [...hint.cells];
    autoDraw(() => {
      const cell = queue.shift();
      if (cell === undefined) return null;
      const result = stepTo(topology, gameRef.current, cell);
      return result.ok ? result.state : null;
    }, settle);
  }, [autoDraw, end, feedback, puzzle.solution, save, show, topology]);

  const reveal = useCallback(() => {
    if (busyRef.current || isZipLocked(gameRef.current)) return;
    runReveal();
  }, [runReveal]);

  return {
    topology,
    game,
    ready,
    locked: isZipLocked(game),
    status,
    shakeSignal,
    refusedCell,
    wrongCells,
    missingCells,
    elapsed: clock.elapsed,
    summary,
    endedNow,
    hintsUsed: game.hintsUsed,
    canUndo: canUndoZip(game),
    canReset: !isZipLocked(game) && game.path.length > 0,
    begin,
    press,
    drag,
    release: closeGesture,
    keyStep,
    undo,
    reset,
    requestHint,
    reveal,
  };
}
