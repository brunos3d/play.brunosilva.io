"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameClock } from "@/shared/hooks/use-game-clock";
import { type SoundName, playSound } from "@/shared/platform/audio";
import { type HapticPattern, vibrate } from "@/shared/platform/haptics";
import type { FinishSummary } from "@/shared/platform/results";
import { loadBoard, saveBoard } from "@/shared/storage/progress";
import type { Settings } from "@/shared/storage/settings";
import { IDLE_STATUS, type StatusMessage } from "@/shared/ui/status-line";
import type { Translate } from "@/i18n/translate";
import {
  type TermoState,
  clearDraft,
  createTermoGame,
  eraseLetter,
  isTermoLocked,
  moveCursor,
  nextHint,
  recordTermoHint,
  revealTermo,
  setCursor,
  submitGuess,
  termoScore,
  typeLetter,
} from "../engine/game/state";
import { endText, foundText, guessErrorText, hintText } from "../engine/text";
import type { TermoShape } from "../engine/types";
import { fromTermoSnapshot, toTermoSnapshot } from "../storage/progress";

export type PlayableTermo = TermoShape & { id: string; seed: string };

/** How long the refused row shakes. */
const SHAKE_MS = 420;

type Options = { puzzle: PlayableTermo; settings: Settings; persist?: boolean };

/** What the status line says once a game is over. Also used when a finished game is reopened. */
function endMessage(t: Translate, puzzle: TermoShape, state: TermoState): StatusMessage {
  return { kind: state.status === "solved" ? "success" : state.revealed ? "info" : "invalid", text: endText(t, puzzle, state) };
}

function summarize(puzzle: TermoShape, state: TermoState, elapsedMs: number): FinishSummary {
  const lost = state.status === "lost" && !state.revealed;
  // A lost game is stored like a revealed one: it closes the day and earns no streak and no best time.
  return { elapsedMs, ...termoScore(puzzle, state), revealed: state.revealed || lost, ...(lost ? { failed: true } : {}) };
}

/**
 * Glue between the pure Termo engine and React: the clock, storage, sound and
 * the messages. Mount it with `key={puzzle.id}` so a new puzzle starts from a
 * clean slate. The word list of the puzzle's language must be loaded.
 */
export function useTermoGame({ puzzle, settings, persist = true }: Options) {
  const t = useTranslations("termo");
  const [game, setGame] = useState<TermoState>(() => createTermoGame(puzzle.id));
  const [ready, setReady] = useState(!persist);
  const [status, setStatus] = useState<StatusMessage>(IDLE_STATUS);
  const [shaking, setShaking] = useState(false);
  /** The guess that was just played. Its tiles turn over one by one. Null after a reload, so old rows do not replay the animation. */
  const [freshRow, setFreshRow] = useState<number | null>(null);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [endedNow, setEndedNow] = useState(false);
  const clock = useGameClock();

  // Source of truth for the handlers. State only drives what is drawn.
  const gameRef = useRef(game);
  const shakeTimer = useRef(0);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => () => window.clearTimeout(shakeTimer.current), []);

  const { clockRef, begin: beginClock, finish: finishClock, restore: restoreClock } = clock;

  const save = useCallback(() => {
    if (persist) void saveBoard("termo", puzzle.id, toTermoSnapshot(gameRef.current, puzzle, clockRef.current));
  }, [clockRef, persist, puzzle]);

  const show = useCallback((next: TermoState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const feedback = useCallback((sound: SoundName, haptic: HapticPattern | null, pitch = 1) => {
    playSound(sound, settingsRef.current.sound, pitch);
    if (haptic) vibrate(haptic, settingsRef.current.haptics);
  }, []);

  const end = useCallback(
    (state: TermoState) => {
      const elapsedMs = finishClock();
      save();
      setEndedNow(true);
      setSummary(summarize(puzzle, state, elapsedMs));
      setStatus(endMessage(t, puzzle, state));
      if (state.status === "solved") feedback("complete", "complete");
      else feedback(state.revealed ? "reveal" : "invalid", state.revealed ? null : "invalid");
    },
    [feedback, finishClock, puzzle, save, t],
  );

  const begin = useCallback(() => {
    if (isTermoLocked(gameRef.current)) return;
    if (beginClock()) save();
  }, [beginClock, save]);

  // Restore saved progress.
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    void loadBoard("termo", puzzle.id).then((snapshot) => {
      if (cancelled) return;
      const restored = fromTermoSnapshot(puzzle.id, puzzle, snapshot);
      if (restored) {
        gameRef.current = restored.state;
        setGame(restored.state);
        restoreClock(restored.clock);
        if (isTermoLocked(restored.state)) {
          setSummary(summarize(puzzle, restored.state, restored.clock.finishedMs ?? 0));
          setStatus(endMessage(t, puzzle, restored.state));
        }
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Runs once per puzzle. restoreClock is stable for the puzzle's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, puzzle]);

  /** Applies an edit to the row being typed. Returns false when nothing changed. */
  const edit = useCallback(
    (change: (state: TermoState) => TermoState, sound: SoundName, haptic: HapticPattern | null): boolean => {
      const next = change(gameRef.current);
      if (next === gameRef.current) return false;
      show(next);
      save();
      setStatus((current) => (current.kind === "invalid" ? IDLE_STATUS : current));
      feedback(sound, haptic);
      return true;
    },
    [feedback, save, show],
  );

  const press = useCallback((letter: string) => void edit((state) => typeLetter(state, letter), "step", "step"), [edit]);
  const erase = useCallback(() => void edit(eraseLetter, "back", "remove"), [edit]);
  const clear = useCallback(() => void edit(clearDraft, "remove", "remove"), [edit]);
  const placeCursor = useCallback((index: number) => void edit((state) => setCursor(state, index), "step", null), [edit]);
  const stepCursor = useCallback((delta: number) => void edit((state) => moveCursor(state, delta), "step", null), [edit]);

  const refuse = useCallback(
    (message: string) => {
      setStatus({ kind: "invalid", text: message });
      setShaking(true);
      window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setShaking(false), SHAKE_MS);
      feedback("invalid", "invalid");
    },
    [feedback],
  );

  /** Enter: plays the row on every open board. */
  const submit = useCallback(() => {
    if (isTermoLocked(gameRef.current)) return;
    const result = submitGuess(puzzle, gameRef.current);
    if (!result.ok) {
      if (result.error) refuse(guessErrorText(t, result.error));
      return;
    }
    show(result.state);
    setFreshRow(result.state.guesses.length - 1);
    save();
    if (result.state.status !== "playing") {
      end(result.state);
      return;
    }
    if (result.found.length > 0) {
      setStatus({ kind: "success", text: foundText(t, puzzle, result.state, result.word) });
      feedback("checkpoint", "checkpoint");
    } else {
      setStatus(IDLE_STATUS);
      feedback("place", "place");
    }
  }, [end, feedback, puzzle, refuse, save, show, t]);

  /** A hint gives away one letter of an open board, in its place. */
  const requestHint = useCallback(() => {
    const state = gameRef.current;
    if (isTermoLocked(state)) return;
    const hint = nextHint(puzzle, state);
    setStatus({ kind: "hint", text: hintText(t, puzzle, hint) });
    if (!hint) return;
    show(recordTermoHint(state, hint));
    save();
    feedback("hint", "hint");
  }, [feedback, puzzle, save, show, t]);

  const reveal = useCallback(() => {
    if (isTermoLocked(gameRef.current)) return;
    const next = revealTermo(gameRef.current);
    show(next);
    end(next);
  }, [end, show]);

  const nothing = useCallback(() => undefined, []);
  const started = game.guesses.length > 0 || game.hints.length > 0 || game.draft.some((letter) => letter !== "");

  return {
    game,
    ready,
    locked: isTermoLocked(game),
    status,
    shaking,
    freshRow,
    elapsed: clock.elapsed,
    summary,
    endedNow,
    hintsUsed: game.hints.length,
    // A guess is final: there is nothing to undo and nothing to reset.
    canUndo: false,
    canReset: false,
    started,
    begin,
    undo: nothing,
    reset: nothing,
    requestHint,
    reveal,
    press,
    erase,
    clear,
    submit,
    placeCursor,
    stepCursor,
  };
}
