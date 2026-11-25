"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOCALE_META } from "@/i18n/config";
import type { GameLanguage } from "@/i18n/game-language";
import { useGameClock } from "@/shared/hooks/use-game-clock";
import { type SoundName, playSound } from "@/shared/platform/audio";
import { type HapticPattern, vibrate } from "@/shared/platform/haptics";
import type { FinishSummary } from "@/shared/platform/results";
import { loadBoard, saveBoard } from "@/shared/storage/progress";
import type { Settings } from "@/shared/storage/settings";
import { IDLE_STATUS, type StatusMessage } from "@/shared/ui/status-line";
import { explainIllegalMove, explainWrongMove } from "../engine/coach/feedback";
import { type CoachMessage, coachFor } from "../engine/coach";
import { type ChessState, beginReveal, canUndoChess, createChessGame, isChessLocked, movesOnBoard, playMove, playReply, playSolutionStep, recordChessHint, resetChess, showPunishment, undoChess } from "../engine/game/state";
import { type Move, moveCaptured, moveFrom, movePromotion, moveTo, pieceType } from "../engine/position";
import { boardView, positionAfter, resolvePuzzle } from "../engine/puzzle";
import type { ChessShape } from "../engine/types";
import { fromChessSnapshot, toChessSnapshot } from "../storage/progress";

export type PlayableChess = ChessShape & { id: string; seed: string };

/** A line in the coach's chat. `id` is its place in the conversation, and `lang` is the HTML language it was said in. */
export type CoachEntry = CoachMessage & { id: number; lang: string };

/** Squares a piece may move to, for the board. */
export type MoveTarget = { to: number; capture: boolean; promotion: boolean };

/** The opponent's opening move is played this long after the board comes into view, so the player sees it happen. */
const OPENING_MS = 550;
/** Pause before the opponent answers a right move. */
const REPLY_MS = 450;
/** Pause before the coach reacts to a wrong move. Long enough for the move to land first. */
const VERDICT_MS = 380;
/** Pause between half-moves while the solution plays itself. */
const REVEAL_STEP_MS = 800;
const MAX_MESSAGES = 40;

type Options = {
  puzzle: PlayableChess;
  settings: Settings;
  /** The game language: the one the coach speaks. It is not the interface locale. */
  language: GameLanguage;
  persist?: boolean;
};

const summarize = (state: ChessState, elapsedMs: number): FinishSummary => ({ elapsedMs, hintsUsed: state.hintsUsed, mistakes: state.mistakes, moves: state.moves, revealed: state.revealed });

/**
 * Glue between the pure chess engine and React: the clock, storage, sound, the
 * coach's conversation and the pauses that make the opponent feel like someone
 * moving pieces. Mount it with `key={puzzle.id}` so a new puzzle starts from a
 * clean slate.
 *
 * The coach is read at the moment she speaks. When the player changes the game
 * language in the middle of a puzzle, the lines already in the chat stay as
 * they were said and the next one comes in the new language.
 */
export function useChessGame({ puzzle, settings, language, persist = true }: Options) {
  const resolved = useMemo(() => resolvePuzzle(puzzle), [puzzle]);
  const [game, setGame] = useState<ChessState>(() => createChessGame(puzzle.id));
  /** False until the opponent's opening move has been played on the board. */
  const [opened, setOpened] = useState(false);
  const [ready, setReady] = useState(!persist);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<CoachEntry[]>([]);
  const [status, setStatus] = useState<StatusMessage>(IDLE_STATUS);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [endedNow, setEndedNow] = useState(false);
  const clock = useGameClock();

  // Sources of truth for the handlers. State only drives what is drawn.
  const gameRef = useRef(game);
  const openedRef = useRef(false);
  const busyRef = useRef(false);
  const timers = useRef(new Set<number>());
  const messageId = useRef(0);
  const variant = useRef(0);
  const settingsRef = useRef(settings);
  const coachRef = useRef(coachFor(language));
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    coachRef.current = coachFor(language);
  }, [language]);
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
    if (persist) void saveBoard("chess", puzzle.id, toChessSnapshot(gameRef.current, puzzle.seed, clockRef.current));
  }, [clockRef, persist, puzzle.id, puzzle.seed]);

  const show = useCallback((next: ChessState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const say = useCallback((message: CoachMessage, kind: StatusMessage["kind"] = "info") => {
    const entry = { ...message, id: ++messageId.current, lang: LOCALE_META[coachRef.current.language].htmlLang };
    setMessages((current) => [...current.slice(-(MAX_MESSAGES - 1)), entry]);
    setStatus({ kind, text: message.text });
  }, []);

  const feedback = useCallback((sound: SoundName, haptic: HapticPattern | null, pitch = 1) => {
    playSound(sound, settingsRef.current.sound, pitch);
    if (haptic) vibrate(haptic, settingsRef.current.haptics);
  }, []);

  /** The sound a move makes when it lands. A check rings a little higher. */
  const moveSound = useCallback(
    (move: Move, check: boolean) => {
      feedback(moveCaptured(move) !== 0 ? "capture" : "move", "place", check ? 1.26 : 1);
    },
    [feedback],
  );

  const linePosition = useCallback((progress: number) => positionAfter(resolved, resolved.line.slice(0, progress)), [resolved]);

  const end = useCallback(
    (state: ChessState) => {
      const elapsedMs = finishClock();
      save();
      setBusyNow(false);
      setEndedNow(true);
      setSummary(summarize(state, elapsedMs));
      later(180, () => feedback("complete", "complete"));
    },
    [feedback, finishClock, later, save, setBusyNow],
  );

  /** Plays the opponent's opening move and lets the coach set the task. */
  const open = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setOpened(true);
    moveSound(resolved.setup, linePosition(0).inCheck());
    say(coachRef.current.intro(resolved));
  }, [linePosition, moveSound, resolved, say]);

  const begin = useCallback(() => {
    if (gameRef.current.status === "solved") return;
    if (beginClock()) save();
    if (!openedRef.current) later(OPENING_MS, open);
  }, [beginClock, later, open, save]);

  /** The opponent answers, then the coach comments on the pair of moves. */
  const answer = useCallback(
    (comment: (reply: Move) => CoachMessage | null) => {
      setBusyNow(true);
      later(REPLY_MS, () => {
        const before = gameRef.current;
        const reply = resolved.line[before.progress];
        const next = playReply(resolved, before);
        show(next);
        moveSound(reply, linePosition(next.progress).inCheck());
        const message = comment(reply);
        if (message) say(message);
        setBusyNow(false);
        save();
      });
    },
    [later, linePosition, moveSound, resolved, save, say, setBusyNow, show],
  );

  const refuse = useCallback(
    (text: string) => {
      setStatus({ kind: "invalid", text });
      setShakeSignal((signal) => signal + 1);
      feedback("invalid", "invalid");
    },
    [feedback],
  );

  /**
   * The player moves a piece. An illegal move changes nothing and says why. A
   * right move advances the line. A wrong move stays on the board while the
   * coach works out what it allows, and waits there to be taken back.
   */
  const tryMove = useCallback(
    (from: number, to: number, promotion = 0) => {
      const state = gameRef.current;
      if (busyRef.current || !openedRef.current || isChessLocked(state) || state.wrong) return;
      const position = linePosition(state.progress);
      const move = position.legalMoves().find((candidate) => moveFrom(candidate) === from && moveTo(candidate) === to && movePromotion(candidate) === promotion);
      if (move === undefined) {
        refuse(coachRef.current.illegal(explainIllegalMove(position, from, to), pieceType(position.board[from]), to));
        return;
      }

      const { state: next, outcome } = playMove(resolved, state, move);
      show(next);
      position.make(move);
      const check = position.inCheck();
      position.unmake(move);
      moveSound(move, check);
      const turn = ++variant.current;

      if (outcome === "solved") {
        say(coachRef.current.solved(resolved, position, move, turn), "success");
        end(next);
        return;
      }
      if (outcome === "continue") {
        answer((reply) => coachRef.current.praise(position, move, reply, turn));
        return;
      }

      setBusyNow(true);
      later(VERDICT_MS, () => {
        const remaining = resolved.shape.mateIn > 0 ? resolved.shape.mateIn - state.progress / 2 : 0;
        const verdict = explainWrongMove(position, move, resolved.shape.kind, remaining);
        // A punishment is shown on the board. A move that merely misses the point is left standing alone.
        const punished = verdict.kind === "mated" || verdict.kind === "loses-material";
        if (punished) {
          show(showPunishment(gameRef.current, verdict.reply));
          feedback(moveCaptured(verdict.reply) !== 0 ? "capture" : "move", null);
        }
        say(coachRef.current.wrong(position, move, verdict, turn), "invalid");
        setShakeSignal((signal) => signal + 1);
        feedback("invalid", "invalid");
        setBusyNow(false);
      });
    },
    [answer, end, feedback, later, linePosition, moveSound, refuse, resolved, say, setBusyNow, show],
  );

  /** Takes the wrong move off the board. The coach's explanation stays in the chat. */
  const takeBack = useCallback(() => {
    if (busyRef.current || !gameRef.current.wrong) return;
    show(undoChess(gameRef.current));
    setStatus({ kind: "info", text: coachRef.current.text.undone });
    feedback("back", "remove");
  }, [feedback, show]);

  const runReveal = useCallback(() => {
    setBusyNow(true);
    // The board plays the line from where it stands, so the coach tells it from there too.
    say(coachRef.current.reveal(resolved, gameRef.current.progress));
    const step = () => {
      const state = gameRef.current;
      if (state.status === "solved") {
        setStatus({ kind: "success", text: coachRef.current.text.revealed });
        end(state);
        return;
      }
      const next = playSolutionStep(resolved, state);
      show(next);
      feedback("reveal", null, 1 + next.progress / resolved.line.length);
      later(REVEAL_STEP_MS, step);
    };
    later(REVEAL_STEP_MS, step);
  }, [end, feedback, later, resolved, say, setBusyNow, show]);

  // Restore saved progress.
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    void loadBoard("chess", puzzle.id).then((snapshot) => {
      if (cancelled) return;
      const restored = fromChessSnapshot(puzzle.id, resolved, snapshot);
      if (restored) {
        gameRef.current = restored.state;
        setGame(restored.state);
        restoreClock(restored.clock);
        const started = restored.state.progress > 0 || restored.state.status === "solved" || restored.state.revealed;
        if (started) {
          // The opening move was seen in an earlier session. The board comes back with it already played.
          openedRef.current = true;
          setOpened(true);
          say(coachRef.current.intro(resolved));
        }
        if (restored.state.status === "solved") {
          setSummary(summarize(restored.state, restored.clock.finishedMs ?? 0));
          say({ mood: "happy", text: restored.state.revealed ? coachRef.current.text.revealed : coachRef.current.text.solvedBefore }, "success");
        } else if (restored.state.revealed) runReveal();
        else if (started) say({ mood: "calm", text: coachRef.current.text.resumed });
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Runs once per puzzle. The callbacks it uses are stable for the puzzle's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, puzzle]);

  const undo = useCallback(() => {
    if (busyRef.current) return;
    const state = gameRef.current;
    if (state.wrong) {
      takeBack();
      return;
    }
    const next = undoChess(state);
    if (next === state) return;
    show(next);
    save();
    say({ mood: "calm", text: coachRef.current.text.undone });
    feedback("back", "remove");
  }, [feedback, save, say, show, takeBack]);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    const next = resetChess(gameRef.current);
    if (next === gameRef.current) return;
    show(next);
    save();
    say({ mood: "calm", text: coachRef.current.text.reset });
    feedback("remove", "remove");
  }, [feedback, save, say, show]);

  /**
   * A hint acts. With a wrong move on the board it takes the move back. The
   * first hint for a move shows which piece plays, and the second plays it.
   */
  const requestHint = useCallback(() => {
    const state = gameRef.current;
    if (busyRef.current || !openedRef.current || isChessLocked(state)) return;
    feedback("hint", "hint");
    const move = resolved.line[state.progress];

    if (state.wrong) {
      show(recordChessHint(undoChess(state)));
      say(coachRef.current.takeBackHint(), "hint");
      save();
      return;
    }
    if (state.hintStage === 0) {
      show(recordChessHint(state));
      say(coachRef.current.pieceHint(resolved, move), "hint");
      save();
      return;
    }

    const position = linePosition(state.progress);
    const next = playSolutionStep(resolved, recordChessHint(state));
    show(next);
    position.make(move);
    const check = position.inCheck();
    position.unmake(move);
    moveSound(move, check);
    say(coachRef.current.moveHint(position, move), "hint");
    if (next.status === "solved") {
      end(next);
      return;
    }
    answer(() => null);
  }, [answer, end, feedback, linePosition, moveSound, resolved, save, say, show]);

  const reveal = useCallback(() => {
    const state = gameRef.current;
    if (busyRef.current || isChessLocked(state)) return;
    if (!openedRef.current) open();
    show(beginReveal(state));
    save();
    runReveal();
  }, [open, runReveal, save, show]);

  const view = useMemo(() => boardView(resolved.fen, opened ? [resolved.setup, ...movesOnBoard(resolved, game)] : []), [game, opened, resolved]);

  /** Where each of the solver's pieces may go right now. Empty while the board takes no moves. */
  const targets = useMemo(() => {
    const map = new Map<number, MoveTarget[]>();
    if (!opened || busy || isChessLocked(game) || game.wrong || game.progress % 2 !== 0) return map;
    const position = positionAfter(resolved, resolved.line.slice(0, game.progress));
    const seen = new Set<number>();
    for (const move of position.legalMoves()) {
      const key = moveFrom(move) * 64 + moveTo(move);
      // The four promotions of one pawn move are one target. The board asks which piece afterwards.
      if (seen.has(key)) continue;
      seen.add(key);
      const list = map.get(moveFrom(move)) ?? [];
      list.push({ to: moveTo(move), capture: moveCaptured(move) !== 0, promotion: movePromotion(move) !== 0 });
      map.set(moveFrom(move), list);
    }
    return map;
  }, [busy, game, opened, resolved]);

  const hintSquare = game.hintStage === 1 && !game.wrong && game.status === "playing" ? moveFrom(resolved.line[game.progress]) : null;
  /** Square of the move the coach has judged: the wrong move while it stands, the last right move otherwise. */
  const verdict = useMemo((): { square: number; good: boolean } | null => {
    if (game.wrong) return busy ? null : { square: moveTo(game.wrong.move), good: false };
    if (game.progress === 0 || game.revealed) return null;
    // The solver's last move is at an even index of the line.
    const index = game.status === "solved" ? game.progress - 1 : game.progress - 2;
    if (index < 0 || index % 2 !== 0) return null;
    return { square: moveTo(game.finish ?? resolved.line[index]), good: true };
  }, [busy, game, resolved]);

  return {
    resolved,
    game,
    view,
    targets,
    opened,
    busy,
    messages,
    /** The coach in the current game language, for her name and the fixed labels around the chat. */
    coach: coachFor(language),
    hintSquare,
    verdict,
    /** The side the player moves. */
    solverColor: resolved.solver,
    ready,
    locked: isChessLocked(game),
    status,
    shakeSignal,
    elapsed: clock.elapsed,
    summary,
    endedNow,
    hintsUsed: game.hintsUsed,
    canUndo: canUndoChess(game) && !busy,
    canReset: !isChessLocked(game) && !busy && (game.progress > 0 || game.wrong !== null),
    begin,
    tryMove,
    takeBack,
    undo,
    reset,
    requestHint,
    reveal,
  };
}
