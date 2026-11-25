"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameClock } from "@/shared/hooks/use-game-clock";
import { type SoundName, playSound } from "@/shared/platform/audio";
import { type HapticPattern, vibrate } from "@/shared/platform/haptics";
import type { FinishSummary } from "@/shared/platform/results";
import { loadBoard, saveBoard } from "@/shared/storage/progress";
import type { Settings } from "@/shared/storage/settings";
import { IDLE_STATUS, type StatusMessage } from "@/shared/ui/status-line";
import {
  type Stroke,
  type WendState,
  applyWendHint,
  beginWendReveal,
  canResetWend,
  canUndoWend,
  createWendGame,
  endStroke,
  foundWords,
  isWendLocked,
  moveStroke,
  resetWend,
  revealWord,
  shortenActiveTrail,
  startStroke,
  trailLetters,
  undoWend,
} from "../engine/game/state";
import type { WendShape } from "../engine/types";
import { fromWendSnapshot, toWendSnapshot } from "../storage/progress";

export type PlayableWend = WendShape & { id: string; seed: string };

/** Pause between words while the solution lays itself down. */
const REVEAL_STEP_MS = 520;
/** How long the letter a hint revealed keeps pulsing. */
const HINT_MS = 1_100;

type Options = { puzzle: PlayableWend; settings: Settings; persist?: boolean };

const summarize = (state: WendState, elapsedMs: number): FinishSummary => ({ elapsedMs, hintsUsed: state.hintsUsed, mistakes: state.mistakes, moves: state.moves, revealed: state.revealed });

const left = (count: number): string => (count === 1 ? "Falta 1 palavra." : `Faltam ${count} palavras.`);

/**
 * Glue between the pure Wend engine and React: the clock, storage, sound and
 * the pauses of hints and reveals. All text it produces is in Portuguese, the
 * language of the words. Mount it with `key={puzzle.id}` so a new puzzle starts
 * from a clean slate.
 */
export function useWendGame({ puzzle, settings, persist = true }: Options) {
  const [game, setGame] = useState<WendState>(() => createWendGame(puzzle.id));
  const [ready, setReady] = useState(!persist);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(IDLE_STATUS);
  /** The letter the last hint revealed. */
  const [hintCell, setHintCell] = useState<number | null>(null);
  /** Goes up each time a word is found, so the board can replay its flourish. */
  const [foundSignal, setFoundSignal] = useState(0);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [endedNow, setEndedNow] = useState(false);
  const clock = useGameClock();

  // Sources of truth for the handlers. State only drives what is drawn.
  const gameRef = useRef(game);
  const strokeRef = useRef<Stroke | null>(null);
  const busyRef = useRef(false);
  const timers = useRef(new Set<number>());
  const hintTimer = useRef(0);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
      window.clearTimeout(hintTimer.current);
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
    if (persist) void saveBoard("wend", puzzle.id, toWendSnapshot(gameRef.current, puzzle.seed, clockRef.current));
  }, [clockRef, persist, puzzle.id, puzzle.seed]);

  const show = useCallback((next: WendState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const feedback = useCallback((sound: SoundName, haptic: HapticPattern | null, pitch = 1) => {
    playSound(sound, settingsRef.current.sound, pitch);
    if (haptic) vibrate(haptic, settingsRef.current.haptics);
  }, []);

  const end = useCallback(
    (state: WendState) => {
      const elapsedMs = finishClock();
      save();
      setBusyNow(false);
      setHintCell(null);
      setEndedNow(true);
      setSummary(summarize(state, elapsedMs));
      setStatus({ kind: "success", text: state.revealed ? "Solução revelada." : "Resolvido. Todas as palavras encontradas." });
      feedback("complete", "complete");
    },
    [feedback, finishClock, save, setBusyNow],
  );

  const begin = useCallback(() => {
    if (gameRef.current.status === "solved") return;
    if (beginClock()) save();
  }, [beginClock, save]);

  const announceFound = useCallback(
    (state: WendState, word: number) => {
      setFoundSignal((signal) => signal + 1);
      const remaining = puzzle.words.length - foundWords(state).length;
      setStatus({ kind: "success", text: `${puzzle.words[word].display}! ${left(remaining)}` });
      feedback("checkpoint", "checkpoint", 1 + foundWords(state).length / (puzzle.words.length * 2));
    },
    [feedback, puzzle.words],
  );

  /** The finger goes down on a cell. */
  const press = useCallback(
    (cell: number) => {
      if (busyRef.current || strokeRef.current) return;
      const started = startStroke(puzzle, gameRef.current, cell);
      if (!started) return;
      strokeRef.current = started.stroke;
      if (started.stroke.pressedAt === null) feedback("step", "step");
      show(started.state);
    },
    [feedback, puzzle, show],
  );

  /** The finger enters another cell. */
  const drag = useCallback(
    (cell: number) => {
      const stroke = strokeRef.current;
      if (!stroke) return;
      const lengthOf = (state: WendState) => state.trails.find((trail) => trail.id === stroke.trail)?.cells.length ?? 0;
      const before = lengthOf(gameRef.current);
      const moved = moveStroke(puzzle, gameRef.current, stroke, cell);
      strokeRef.current = moved.stroke;
      const after = lengthOf(moved.state);
      if (after > before) feedback("step", "step", 1 + after / 16);
      else if (after < before) feedback("back", null);
      if (moved.state !== gameRef.current) show(moved.state);
    },
    [feedback, puzzle, show],
  );

  /** The finger lifts. */
  const release = useCallback(() => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    strokeRef.current = null;
    const result = endStroke(puzzle, gameRef.current, stroke);
    show(result.state);
    if (!result.changed) return;
    setHintCell(null);
    save();
    if (result.found !== null) {
      announceFound(result.state, result.found);
      if (result.solved) end(result.state);
      return;
    }
    if (result.erased) {
      setStatus({ kind: "info", text: "Traço apagado." });
      feedback("remove", "remove");
    } else if (result.elsewhere) {
      const trail = result.state.trails.find((entry) => entry.id === result.state.active);
      setStatus({ kind: "info", text: `${trail ? trailLetters(puzzle, trail.cells) : "Essa palavra"} está no tabuleiro, mas passa por outras casas.` });
    } else {
      setStatus(IDLE_STATUS);
    }
  }, [announceFound, end, feedback, puzzle, save, show]);

  /** Keyboard: the same as a tap on a cell. */
  const tap = useCallback(
    (cell: number) => {
      press(cell);
      release();
    },
    [press, release],
  );

  /** Keyboard: takes the last letter off the trail touched last. */
  const back = useCallback(() => {
    if (busyRef.current || strokeRef.current) return;
    const next = shortenActiveTrail(gameRef.current);
    if (next === gameRef.current) return;
    show(next);
    save();
    setStatus(IDLE_STATUS);
    feedback("back", null);
  }, [feedback, save, show]);

  const runReveal = useCallback(() => {
    setBusyNow(true);
    setHintCell(null);
    setStatus({ kind: "info", text: "Revelando a solução." });
    const step = () => {
      const next = revealWord(puzzle, gameRef.current);
      if (next === gameRef.current || next.status === "solved") {
        show(next);
        setFoundSignal((signal) => signal + 1);
        end(next);
        return;
      }
      show(next);
      setFoundSignal((signal) => signal + 1);
      feedback("reveal", null, 1 + foundWords(next).length / (puzzle.words.length * 2));
      later(REVEAL_STEP_MS, step);
    };
    later(REVEAL_STEP_MS, step);
  }, [end, feedback, later, puzzle, setBusyNow, show]);

  // Restore saved progress.
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    void loadBoard("wend", puzzle.id).then((snapshot) => {
      if (cancelled) return;
      const restored = fromWendSnapshot(puzzle.id, puzzle, snapshot, puzzle.seed);
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
    if (busyRef.current || strokeRef.current) return;
    const next = undoWend(gameRef.current);
    if (next === gameRef.current) return;
    setHintCell(null);
    show(next);
    save();
    setStatus({ kind: "info", text: "Último traço desfeito." });
    feedback("back", "remove");
  }, [feedback, save, show]);

  const reset = useCallback(() => {
    if (busyRef.current || strokeRef.current) return;
    const next = resetWend(gameRef.current);
    if (next === gameRef.current) return;
    setHintCell(null);
    show(next);
    save();
    setStatus({ kind: "info", text: "Traços soltos apagados. As palavras encontradas ficam, e o relógio continua correndo." });
    feedback("remove", "remove");
  }, [feedback, save, show]);

  /** A hint acts: it erases the trails that lead nowhere and reveals one letter. */
  const requestHint = useCallback(() => {
    if (busyRef.current || strokeRef.current || isWendLocked(gameRef.current)) return;
    const hint = applyWendHint(puzzle, gameRef.current);
    if (!hint) return;
    show(hint.state);
    save();
    setHintCell(hint.cell);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHintCell(null), HINT_MS);
    const fixed = hint.cleared === 0 ? "" : hint.cleared === 1 ? "Erro corrigido. " : "Erros corrigidos. ";
    if (hint.found) {
      setFoundSignal((signal) => signal + 1);
      setStatus({ kind: "hint", text: `${fixed}Última letra revelada: ${puzzle.words[hint.word].display}.` });
      feedback("checkpoint", "checkpoint");
      if (hint.solved) end(hint.state);
      return;
    }
    setStatus({ kind: "hint", text: `${fixed}${hint.first ? "Primeira letra de uma palavra revelada." : "Próxima letra revelada."}` });
    feedback("hint", "hint");
  }, [end, feedback, puzzle, save, show]);

  const reveal = useCallback(() => {
    if (busyRef.current || strokeRef.current || isWendLocked(gameRef.current)) return;
    show(beginWendReveal(gameRef.current));
    save();
    runReveal();
  }, [runReveal, save, show]);

  return {
    game,
    hintCell,
    foundSignal,
    busy,
    ready,
    locked: isWendLocked(game),
    status,
    elapsed: clock.elapsed,
    summary,
    endedNow,
    hintsUsed: game.hintsUsed,
    canUndo: canUndoWend(game) && !busy,
    canReset: canResetWend(game) && !busy,
    started: game.trails.length > 0 || game.hintsUsed > 0,
    begin,
    press,
    drag,
    release,
    tap,
    back,
    undo,
    reset,
    requestHint,
    reveal,
  };
}
