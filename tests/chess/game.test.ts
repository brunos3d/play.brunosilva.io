import { describe, expect, it } from "vitest";
import {
  COACH_TEXT,
  LETTERS_PT,
  Position,
  beginReveal,
  canUndoChess,
  createChessGame,
  explainIllegalMove,
  explainWrongMove,
  findMove,
  generateChessPuzzle,
  illegalMessage,
  introMessage,
  isSolutionMove,
  moveFromUci,
  moveHintMessage,
  movesOnBoard,
  pieceHintMessage,
  playMove,
  playReply,
  playSolutionStep,
  positionAfter,
  praiseMessage,
  recordChessHint,
  resetChess,
  resolvePuzzle,
  revealMessage,
  showPunishment,
  solvedMessage,
  toSan,
  undoChess,
  validateChessPuzzle,
  wrongMessage,
  type ChessShape,
} from "@/games/chess/engine";
import { CHESS_TUTORIAL_PUZZLE } from "@/games/chess/components/tutorial/tutorial-puzzle";
import { fromChessSnapshot, toChessSnapshot } from "@/games/chess/storage/progress";

/** Smothered mate in two: 1. Qg8+ Rxg8 2. Nf7#. Black's opening move is Rf8, walking into it. */
const SMOTHERED: ChessShape = {
  fen: "4r2k/6pp/7N/8/8/1Q6/8/6K1 b - - 0 1",
  setup: "e8f8",
  line: ["b3g8", "f8g8", "h6f7"],
  solver: "white",
  kind: "mate",
  mateIn: 2,
  themes: ["sacrifice", "smotheredMate", "mateIn2"],
};
/** A mate in one with several mates: the stored one is Qg7, and Qh7 and Rb8 mate as well. Not a valid puzzle, but a valid last move. */
const TWO_MATES: ChessShape = {
  fen: "6k1/1R6/6Q1/8/8/8/8/K7 b - - 0 1",
  setup: "g8h8",
  line: ["g6g7"],
  solver: "white",
  kind: "mate",
  mateIn: 1,
  themes: ["mateIn1"],
};
/** A knight left hanging: Black played Nd6, where the rook takes it for free. */
const HANGING: ChessShape = {
  fen: "4k3/5n2/8/8/8/8/3R1PPP/6K1 b - - 0 1",
  setup: "f7d6",
  line: ["d2d6"],
  solver: "white",
  kind: "advantage",
  mateIn: 0,
  themes: ["hangingPiece"],
};

const smothered = resolvePuzzle(SMOTHERED);
const RUNNING = { startedAt: 1_790_000_000_000, finishedMs: null };
const move = (puzzle: ReturnType<typeof resolvePuzzle>, played: number[], uci: string) => moveFromUci(positionAfter(puzzle, played), uci);

describe("fixtures", () => {
  it("are sound puzzles, the tutorial included", () => {
    for (const shape of [SMOTHERED, HANGING, CHESS_TUTORIAL_PUZZLE]) expect(validateChessPuzzle(shape).errors).toEqual([]);
    // The position with several mates is about the last move of a line, so only its moves are checked.
    expect(() => resolvePuzzle(TWO_MATES)).not.toThrow();
    expect(validateChessPuzzle(TWO_MATES).errors).toEqual(["move 1: 5 moves mate in time"]);
    expect(() => resolvePuzzle({ ...SMOTHERED, setup: "e8e1" })).toThrow();
    expect(() => resolvePuzzle({ ...SMOTHERED, line: ["b3g8", "f8g8"] })).toThrow(/solver move/);
    expect(() => resolvePuzzle({ ...SMOTHERED, solver: "black" })).toThrow(/wrong side/);
  });
});

describe("game state", () => {
  it("walks the solution: right move, reply, right move, solved", () => {
    let state = createChessGame("p");
    expect(movesOnBoard(smothered, state)).toEqual([]);
    expect(findMove(smothered, state, 17, 62)).toBe(smothered.line[0]);
    expect(findMove(smothered, state, 17, 63)).toBe(0);

    let step = playMove(smothered, state, smothered.line[0]);
    expect(step.outcome).toBe("continue");
    state = playReply(smothered, step.state);
    expect(state.progress).toBe(2);
    expect(canUndoChess(state)).toBe(true);

    step = playMove(smothered, state, smothered.line[2]);
    expect(step.outcome).toBe("solved");
    expect(step.state).toMatchObject({ status: "solved", progress: 3, moves: 2, mistakes: 0, finish: null });
    expect(movesOnBoard(smothered, step.state)).toEqual(smothered.line);
    // A solved board takes no more moves and cannot be undone.
    expect(playMove(smothered, step.state, smothered.line[2]).state).toBe(step.state);
    expect(undoChess(step.state)).toBe(step.state);
    expect(resetChess(step.state)).toBe(step.state);
  });

  it("keeps a wrong move on the board until it is taken back, and counts it", () => {
    const start = createChessGame("p");
    const wrong = move(smothered, [], "b3b7");
    const step = playMove(smothered, start, wrong);
    expect(step.outcome).toBe("wrong");
    expect(step.state).toMatchObject({ progress: 0, moves: 1, mistakes: 1, wrong: { move: wrong, reply: null } });
    expect(movesOnBoard(smothered, step.state)).toEqual([wrong]);
    // Nothing else can be played over a wrong move.
    expect(findMove(smothered, step.state, 17, 62)).toBe(0);
    expect(playMove(smothered, step.state, smothered.line[0]).state).toBe(step.state);

    const reply = moveFromUci(positionAfter(smothered, [wrong]), "f8f1");
    const punished = showPunishment(step.state, reply);
    expect(movesOnBoard(smothered, punished)).toEqual([wrong, reply]);

    const back = undoChess(punished);
    expect(back).toMatchObject({ wrong: null, progress: 0, moves: 1, mistakes: 1 });
    expect(canUndoChess(back)).toBe(false);
  });

  it("accepts any mate on the last move and shows the one that was played", () => {
    const puzzle = resolvePuzzle(TWO_MATES);
    const start = createChessGame("p");
    const other = move(puzzle, [], "g6h7");
    expect(other).not.toBe(puzzle.line[0]);
    expect(isSolutionMove(puzzle, start, other)).toBe(true);
    const step = playMove(puzzle, start, other);
    expect(step.outcome).toBe("solved");
    expect(step.state).toMatchObject({ status: "solved", progress: 1, finish: other, mistakes: 0 });
    expect(movesOnBoard(puzzle, step.state)).toEqual([other]);
    // A move that does not mate is still wrong.
    expect(playMove(puzzle, start, move(puzzle, [], "a1a2")).outcome).toBe("wrong");
  });

  it("undoes one full move, resets to the start and keeps the counters", () => {
    let state = playReply(smothered, playMove(smothered, createChessGame("p"), smothered.line[0]).state);
    state = recordChessHint(state);
    expect(state.hintStage).toBe(1);
    const undone = undoChess(state);
    expect(undone).toMatchObject({ progress: 0, hintStage: 0, moves: 1, hintsUsed: 1 });
    expect(resetChess(undone)).toBe(undone);
    expect(resetChess(state)).toMatchObject({ progress: 0, moves: 1, hintsUsed: 1 });
  });

  it("hints in two steps and reveals by playing the line", () => {
    let state = recordChessHint(createChessGame("p"));
    expect([state.hintsUsed, state.hintStage]).toEqual([1, 1]);
    state = playSolutionStep(smothered, recordChessHint(state));
    expect([state.hintsUsed, state.hintStage, state.progress, state.moves]).toEqual([2, 0, 1, 0]);

    let revealed = beginReveal(createChessGame("p"));
    expect(playMove(smothered, revealed, smothered.line[0]).state).toBe(revealed);
    for (let index = 0; index < smothered.line.length; index++) revealed = playSolutionStep(smothered, revealed);
    expect(revealed).toMatchObject({ status: "solved", revealed: true, progress: 3 });
  });
});

describe("coach", () => {
  const start = positionAfter(smothered, []);
  const explain = (uci: string) => {
    const wrong = moveFromUci(start, uci);
    const feedback = explainWrongMove(start, wrong, "mate", 2);
    return { feedback, text: wrongMessage(start, wrong, feedback, 0).text };
  };

  it("says what a wrong move loses, without naming the right one", () => {
    const solution = toSan(start, smothered.line[0], LETTERS_PT);
    const knight = explain("g1g2");
    expect(knight.feedback).toMatchObject({ kind: "loses-material", lost: 2, moved: false });
    expect(knight.text).toBe("Mas e o seu cavalo? Depois de Rg2, o adversário captura em h6 com gxh6.");

    const queen = explain("b3f3");
    expect(queen.feedback).toMatchObject({ kind: "loses-material", lost: 5, moved: true });
    expect(queen.text).toMatch(/sua dama/);

    const quiet = explain("b3b4");
    expect(quiet.feedback.kind).toBe("too-slow");

    for (const { text } of [knight, queen, quiet]) expect(text).not.toContain(solution);
    // The analysis left the position as it found it.
    expect(start.toFen()).toBe(positionAfter(smothered, []).toFen());
  });

  it("warns when the move lets the opponent mate", () => {
    const position = Position.fromFen("4k3/8/8/8/8/8/r4PPP/3R2K1 w - - 0 1");
    const wrong = moveFromUci(position, "d1d2");
    const feedback = explainWrongMove(position, wrong, "advantage", 0);
    expect(feedback).toMatchObject({ kind: "mated", mateIn: 2 });
    expect(wrongMessage(position, wrong, feedback, 0).text).toBe("Cuidado! Td2 permite Ta1+, e o adversário dá mate em 2 lances.");
  });

  it("tells a check that leads nowhere from a slower mate", () => {
    // Nf7+ is Philidor's legacy the long way round: still a forced mate, one move later.
    expect(explain("h6f7").feedback.kind).toBe("slower-mate");
    const position = Position.fromFen("4k3/pppp1ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1");
    const check = moveFromUci(position, "d1e2");
    const feedback = explainWrongMove(position, check, "mate", 1);
    expect(feedback.kind).toBe("check-answered");
    expect(wrongMessage(position, check, feedback, 0).text).toContain("De2+ é xeque");
  });

  it("calls a small capture small and a miss a miss", () => {
    const hanging = resolvePuzzle(HANGING);
    const position = positionAfter(hanging, []);
    const miss = explainWrongMove(position, moveFromUci(position, "g1f1"), "advantage", 0);
    expect(miss.kind).toBe("misses");
    expect(wrongMessage(position, moveFromUci(position, "g1f1"), miss, 1).text).not.toContain("Txd6");
  });

  it("explains illegal moves by their reason", () => {
    const pinned = Position.fromFen("4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1");
    expect(explainIllegalMove(pinned, 12, 19)).toBe("exposes-king");
    expect(explainIllegalMove(pinned, 12, 28)).toBe("unreachable");
    const checked = Position.fromFen("4r1k1/8/8/8/8/8/3B4/4K3 w - - 0 1");
    expect(explainIllegalMove(checked, 11, 18)).toBe("in-check");
    expect(illegalMessage("unreachable", 3, 28)).toBe("O bispo não pode ir para e4.");
    expect(illegalMessage("in-check", 3, 18)).toContain("xeque");
  });

  it("writes every line in Portuguese notation", () => {
    expect(introMessage(smothered).text).toBe("As pretas jogaram Tf8. Foi um erro: existe xeque-mate forçado em 2 lances. Você joga de brancas.");
    expect(introMessage(resolvePuzzle(HANGING)).text).toContain("deixaram material de graça");
    expect(introMessage(resolvePuzzle(CHESS_TUTORIAL_PUZZLE)).text).toContain("xeque-mate em 1 lance");
    expect(pieceHintMessage(smothered, smothered.line[0]).text).toBe("Dica: quem joga agora é a dama em b3. Às vezes vale entregar uma peça para abrir o caminho.");
    expect(moveHintMessage(start, smothered.line[0]).text).toContain("Dg8+");
    expect(praiseMessage(start, smothered.line[0], smothered.line[1], 0).text).toContain("O adversário respondeu Txg8");
    const beforeMate = positionAfter(smothered, smothered.line.slice(0, 2));
    expect(solvedMessage(smothered, beforeMate, smothered.line[2], 0).text).toContain("Cf7#");
    const hanging = resolvePuzzle(HANGING);
    expect(solvedMessage(hanging, positionAfter(hanging, []), hanging.line[0], 0).text).toContain("o cavalo");
    expect(revealMessage(smothered).text).toContain("2. Dg8+ Txg8 3. Cf7#");
    expect(COACH_TEXT.takeBack).toMatch(/voltar/);
  });
});

describe("chess snapshot", () => {
  const roundTrip = (snapshot: unknown, puzzle = smothered) => fromChessSnapshot("p", puzzle, JSON.parse(JSON.stringify(snapshot)));
  const midway = playReply(smothered, playMove(smothered, createChessGame("p"), smothered.line[0]).state);

  it("round-trips progress, counters and the running clock", () => {
    const state = { ...midway, mistakes: 2, moves: 3, hintsUsed: 1 };
    const restored = roundTrip(toChessSnapshot(state, "seed", RUNNING));
    expect(restored?.state).toEqual(state);
    expect(restored?.clock).toEqual(RUNNING);
  });

  it("never stores a wrong move, and plays the pending reply on load", () => {
    const wrong = playMove(smothered, midway, move(smothered, smothered.line.slice(0, 2), "g1h1")).state;
    expect(roundTrip(toChessSnapshot(wrong, "seed", RUNNING))?.state).toMatchObject({ wrong: null, progress: 2, mistakes: 1 });
    const between = playMove(smothered, createChessGame("p"), smothered.line[0]).state;
    expect(between.progress).toBe(1);
    expect(roundTrip(toChessSnapshot(between, "seed", RUNNING))?.state.progress).toBe(2);
  });

  it("restores a solved board only with a final time, and a different mate only if it is one", () => {
    const solved = playMove(smothered, midway, smothered.line[2]).state;
    const done = { startedAt: 1, finishedMs: 30_000 };
    expect(roundTrip(toChessSnapshot(solved, "seed", done))?.state.status).toBe("solved");
    expect(roundTrip(toChessSnapshot(solved, "seed", RUNNING))).toBeNull();
    expect(roundTrip(toChessSnapshot(midway, "seed", done))).toBeNull();

    const several = resolvePuzzle(TWO_MATES);
    const other = playMove(several, createChessGame("p"), move(several, [], "g6h7")).state;
    const snapshot = toChessSnapshot(other, "seed", done);
    expect(snapshot.finish).toBe("g6h7");
    expect(roundTrip(snapshot, several)?.state).toEqual(other);
    // A stored finishing move has to be legal and has to be mate.
    expect(roundTrip({ ...snapshot, finish: "a1a2" }, several)).toBeNull();
    expect(roundTrip({ ...snapshot, finish: "a1a8" }, several)).toBeNull();
  });

  it("rejects anything that does not fit the puzzle", () => {
    const good = toChessSnapshot(midway, "seed", RUNNING);
    expect(roundTrip({ ...good, progress: 9 })).toBeNull();
    expect(roundTrip({ ...good, progress: -1 })).toBeNull();
    expect(roundTrip({ ...good, progress: 1.5 })).toBeNull();
    expect(roundTrip({ ...good, solved: true })).toBeNull();
    expect(roundTrip({ ...good, puzzleId: "other" })).toBeNull();
    expect(roundTrip({ ...good, snapshotVersion: 99 })).toBeNull();
    expect(roundTrip({ ...good, moves: "many" })).toBeNull();
    expect(roundTrip(null)).toBeNull();
    expect(roundTrip("junk")).toBeNull();
  });

  it("works on a generated puzzle too", () => {
    const puzzle = generateChessPuzzle("storage", "hard");
    const resolved = resolvePuzzle(puzzle);
    let state = createChessGame(puzzle.id);
    state = playReply(resolved, playMove(resolved, state, resolved.line[0]).state);
    expect(fromChessSnapshot(puzzle.id, resolved, toChessSnapshot(state, puzzle.seed, RUNNING))?.state).toEqual(state);
  });
});
