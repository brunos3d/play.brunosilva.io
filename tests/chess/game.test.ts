import { describe, expect, it } from "vitest";
import {
  Position,
  beginReveal,
  canUndoChess,
  coachFor,
  createChessGame,
  explainIllegalMove,
  explainWrongMove,
  findMove,
  generateChessPuzzle,
  isSolutionMove,
  moveFromUci,
  movesOnBoard,
  playMove,
  playReply,
  playSolutionStep,
  positionAfter,
  recordChessHint,
  resetChess,
  resolvePuzzle,
  showPunishment,
  undoChess,
  validateChessPuzzle,
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
  const pt = coachFor("pt-br");
  const en = coachFor("en");
  const start = positionAfter(smothered, []);
  const explain = (uci: string) => {
    const wrong = moveFromUci(start, uci);
    const feedback = explainWrongMove(start, wrong, "mate", 2);
    return { feedback, pt: pt.wrong(start, wrong, feedback, 0).text, en: en.wrong(start, wrong, feedback, 0).text };
  };

  it("says what a wrong move loses, without naming the right one", () => {
    const knight = explain("g1g2");
    expect(knight.feedback).toMatchObject({ kind: "loses-material", lost: 2, moved: false });
    expect(knight.pt).toBe("Mas e o seu cavalo? Depois desse lance, o adversário captura o cavalo em h6 com o peão.");
    expect(knight.en).toBe("But what about your knight? After that move, your opponent takes the knight on h6 with the pawn.");

    const queen = explain("b3f3");
    expect(queen.feedback).toMatchObject({ kind: "loses-material", lost: 5, moved: true });
    expect(queen.pt).toBe("E a sua dama? Em f3, ela é capturada pela torre.");
    expect(queen.en).toBe("What about your queen? On f3, it is taken by the rook.");

    const quiet = explain("b3b4");
    expect(quiet.feedback.kind).toBe("too-slow");
    expect(quiet.pt).toBe("Esse lance dá tempo para o rei adversário se defender. Em um mate forçado, comece pelos xeques.");
    expect(quiet.en).toBe("That move gives the enemy king time to defend. In a forced mate, start with the checks.");

    // The square the solution goes to is the giveaway, in any wording.
    for (const { pt: portuguese, en: english } of [knight, queen, quiet]) {
      expect(portuguese).not.toContain("g8");
      expect(english).not.toContain("g8");
    }
    // The analysis left the position as it found it.
    expect(start.toFen()).toBe(positionAfter(smothered, []).toFen());
  });

  it("warns when the move lets the opponent mate", () => {
    const position = Position.fromFen("4k3/8/8/8/8/8/r4PPP/3R2K1 w - - 0 1");
    const wrong = moveFromUci(position, "d1d2");
    const feedback = explainWrongMove(position, wrong, "advantage", 0);
    expect(feedback).toMatchObject({ kind: "mated", mateIn: 2 });
    expect(pt.wrong(position, wrong, feedback, 0).text).toBe("Cuidado! Agora o adversário move a torre para a1, dando xeque. O mate vem no lance seguinte.");
    expect(en.wrong(position, wrong, feedback, 0).text).toBe("Careful! Now your opponent moves the rook to a1, giving check. Mate comes on the next move.");

    // A king that walks into the corner behind its own pawns is mated on the spot.
    const corner = Position.fromFen("4k3/8/8/8/8/8/r4PPP/5K2 w - - 0 1");
    const walk = moveFromUci(corner, "f1g1");
    const now = explainWrongMove(corner, walk, "advantage", 0);
    expect(now).toMatchObject({ kind: "mated", mateIn: 1 });
    expect(pt.wrong(corner, walk, now, 0).text).toBe("Cuidado! Depois desse lance, o adversário move a torre para a1: xeque-mate.");
    expect(en.wrong(corner, walk, now, 0).text).toBe("Careful! After that move, your opponent moves the rook to a1: checkmate.");
  });

  it("tells a check that leads nowhere from a slower mate", () => {
    // Nf7+ is Philidor's legacy the long way round: still a forced mate, one move later.
    const slower = explain("h6f7");
    expect(slower.feedback.kind).toBe("slower-mate");
    expect(slower.pt).toBe("Esse lance também vence, mas existe um mate mais rápido. Tente de novo.");
    expect(slower.en).toBe("That move wins too, but there is a faster mate. Try again.");

    const position = Position.fromFen("4k3/pppp1ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1");
    const check = moveFromUci(position, "d1e2");
    const feedback = explainWrongMove(position, check, "mate", 1);
    expect(feedback.kind).toBe("check-answered");
    // The answer is not shown on the board, so the coach says what the opponent can do.
    expect(pt.wrong(position, check, feedback, 0).text).toMatch(/^É xeque, mas não basta: o adversário pode mover o rei para [df]8\. O mate precisa ser forçado até o fim\.$/);
    expect(en.wrong(position, check, feedback, 1).text).toMatch(/^Check is not mate: here your opponent can move the king to [df]8\. Look for a stronger check\.$/);
  });

  it("calls a small capture small and a miss a miss", () => {
    const hanging = resolvePuzzle(HANGING);
    const position = positionAfter(hanging, []);
    const quiet = moveFromUci(position, "g1f1");
    const miss = explainWrongMove(position, quiet, "advantage", 0);
    expect(miss.kind).toBe("misses");
    for (const coach of [pt, en]) for (const variant of [0, 1]) expect(coach.wrong(position, quiet, miss, variant).text).not.toContain("d6");

    // A pawn for the taking, while a pawn of ours could take a whole rook.
    const greedy = Position.fromFen("4k3/8/8/8/3p4/7r/3R2P1/6K1 w - - 0 1");
    const pawn = moveFromUci(greedy, "d2d4");
    const small = explainWrongMove(greedy, pawn, "advantage", 0);
    expect(small).toMatchObject({ kind: "small-gain", taken: 1 });
    expect(pt.wrong(greedy, pawn, small, 0).text).toBe("Capturar o peão é pouco. Tem um prêmio maior no tabuleiro.");
    expect(pt.wrong(greedy, pawn, small, 1).text).toBe("Esse lance ganha um peão, mas o erro do adversário vale mais do que isso.");
    expect(en.wrong(greedy, pawn, small, 0).text).toBe("Taking the pawn is not much. There is a bigger prize on the board.");
    expect(en.wrong(greedy, pawn, small, 1).text).toBe("That move wins a pawn, but your opponent's mistake is worth more than that.");
  });

  it("explains illegal moves by their reason", () => {
    const pinned = Position.fromFen("4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1");
    expect(explainIllegalMove(pinned, 12, 19)).toBe("exposes-king");
    expect(explainIllegalMove(pinned, 12, 28)).toBe("unreachable");
    const checked = Position.fromFen("4r1k1/8/8/8/8/8/3B4/4K3 w - - 0 1");
    expect(explainIllegalMove(checked, 11, 18)).toBe("in-check");
    expect(pt.illegal("unreachable", 3, 28)).toBe("O bispo não pode ir para e4.");
    expect(pt.illegal("unreachable", 4, 28)).toBe("A torre não pode ir para e4.");
    expect(en.illegal("unreachable", 3, 28)).toBe("The bishop cannot go to e4.");
    expect(pt.illegal("in-check", 3, 18)).toBe("Seu rei está em xeque. O lance precisa tirar o rei do xeque.");
    expect(en.illegal("in-check", 3, 18)).toBe("Your king is in check. The move has to get the king out of check.");
    expect(pt.illegal("exposes-king", 3, 19)).toBe("Esse lance deixaria o seu rei em xeque.");
    expect(en.illegal("exposes-king", 3, 19)).toBe("That move would leave your king in check.");
  });

  it("opens every kind of puzzle with the opponent's move in words", () => {
    expect(pt.intro(smothered).text).toBe("As pretas moveram a torre para f8. Foi um erro: existe xeque-mate forçado em 2 lances. Você joga de brancas.");
    expect(en.intro(smothered).text).toBe("Black moved the rook to f8. That was a mistake: there is a forced checkmate in 2 moves. You play White.");
    const hanging = resolvePuzzle(HANGING);
    expect(pt.intro(hanging).text).toBe("As pretas moveram o cavalo para d6. Esse lance deixou material de graça. Você joga de brancas: encontre o lance que ganha.");
    expect(en.intro(hanging).text).toBe("Black moved the knight to d6. That move left material for free. You play White: find the move that wins it.");
    const tutorial = resolvePuzzle(CHESS_TUTORIAL_PUZZLE);
    expect(pt.intro(tutorial).text).toBe("As pretas moveram a torre para a2. Com isso, o rei delas ficou sem saída. Você joga de brancas: dê xeque-mate em 1 lance.");
    expect(en.intro(tutorial).text).toBe("Black moved the rook to a2. That left their king with no way out. You play White: give checkmate in 1 move.");
    // The two other openings only differ in the sentence after the move.
    expect(pt.intro({ ...hanging, shape: { ...HANGING, kind: "defence" } }).text).toBe("As pretas moveram o cavalo para d6. É uma ameaça séria. Você joga de brancas, e só um lance mantém a posição de pé.");
    expect(en.intro({ ...hanging, shape: { ...HANGING, kind: "defence" } }).text).toBe("Black moved the knight to d6. That is a serious threat. You play White, and only one move holds the position together.");
    const longer = { ...smothered, shape: { ...SMOTHERED, kind: "advantage" as const } };
    expect(pt.intro(longer).text).toBe("As pretas moveram a torre para f8. Parece seguro, mas perde material em 2 lances. Você joga de brancas.");
    expect(en.intro(longer).text).toBe("Black moved the rook to f8. It looks safe, but it loses material in 2 moves. You play White.");
  });

  it("hints at the piece first and only then tells the move", () => {
    expect(pt.pieceHint(smothered, smothered.line[0]).text).toBe("Dica: quem joga agora é a dama em b3. Às vezes vale entregar uma peça para abrir o caminho.");
    expect(en.pieceHint(smothered, smothered.line[0]).text).toBe("Hint: the piece to move is the queen on b3. Sometimes it pays to give up a piece to open the way.");
    expect(pt.moveHint(start, smothered.line[0]).text).toBe("O lance era mover a dama para g8, dando xeque. Repare por que ele funciona.");
    expect(en.moveHint(start, smothered.line[0]).text).toBe("The answer was to move the queen to g8, giving check. Notice why it works.");
    // A hint that plays the mate has nothing to add to it.
    const beforeMate = positionAfter(smothered, smothered.line.slice(0, 2));
    expect(pt.moveHint(beforeMate, smothered.line[2]).text).toBe("O lance era mover o cavalo para f7: xeque-mate.");
    expect(en.moveHint(beforeMate, smothered.line[2]).text).toBe("The answer was to move the knight to f7: checkmate.");
    expect(pt.takeBackHint().text).toBe("Voltei o seu lance: ele não resolve. Tente outro caminho, ou peça outra dica.");
    expect(en.takeBackHint().text).toBe("I took your move back: it does not solve the puzzle. Try another way, or ask for another hint.");
  });

  it("comments on a right move and on the reply to it", () => {
    const [first, reply, last] = smothered.line;
    expect(pt.praise(start, first, reply, 0).text).toBe("Boa! A dama vai para g8, dando xeque. O adversário respondeu capturando a dama com a torre. Como continuar?");
    expect(pt.praise(start, first, reply, 1).text).toBe("Isso mesmo: a dama vai para g8, dando xeque. O adversário respondeu capturando a dama com a torre. Como continuar?");
    expect(en.praise(start, first, reply, 0).text).toBe("Nice! The queen goes to g8, giving check. Your opponent replied by taking the queen with the rook. How do you continue?");
    expect(en.praise(start, first, reply, 3).text).toBe("Well done: the queen goes to g8, giving check. Your opponent replied by taking the queen with the rook. What now?");
    expect(start.toFen()).toBe(positionAfter(smothered, []).toFen());

    const beforeMate = positionAfter(smothered, smothered.line.slice(0, 2));
    expect(pt.solved(smothered, beforeMate, last, 0).text).toBe("Xeque-mate! O cavalo vai para f7 e encerra a partida. Muito bem.");
    expect(pt.solved(smothered, beforeMate, last, 1).text).toBe("O cavalo vai para f7 e acabou: xeque-mate. Belo lance!");
    expect(pt.solved(smothered, beforeMate, last, 2).text).toBe("O cavalo vai para f7: xeque-mate. Perfeito!");
    expect(en.solved(smothered, beforeMate, last, 0).text).toBe("Checkmate! The knight goes to f7 and the game is over. Well done.");
    expect(en.solved(smothered, beforeMate, last, 1).text).toBe("The knight goes to f7 and that's it: checkmate. Lovely move!");
    expect(en.solved(smothered, beforeMate, last, 2).text).toBe("The knight goes to f7: checkmate. Perfect!");

    const hanging = resolvePuzzle(HANGING);
    const won = positionAfter(hanging, []);
    expect(pt.solved(hanging, won, hanging.line[0], 0).text).toBe("A torre captura o cavalo em d6. Material ganho, problema resolvido.");
    expect(pt.solved(hanging, won, hanging.line[0], 1).text).toBe("Perfeito: a torre captura o cavalo em d6. A vantagem é sua.");
    expect(en.solved(hanging, won, hanging.line[0], 0).text).toBe("The rook takes the knight on d6. Material won, puzzle solved.");
    expect(en.solved(hanging, won, hanging.line[0], 2).text).toBe("Well done! The rook takes the knight on d6. You came out ahead.");
    const held = { ...hanging, shape: { ...HANGING, kind: "defence" as const } };
    expect(pt.solved(held, won, hanging.line[0], 0).text).toBe("A torre captura o cavalo em d6: era o único lance. Posição salva, muito bem!");
    expect(en.solved(held, won, hanging.line[0], 0).text).toBe("The rook takes the knight on d6: that was the only move. Position saved, well done!");
  });

  it("reveals the solution as a sequence in words, from wherever the board stands", () => {
    expect(pt.reveal(smothered).text).toBe("Veja a solução. Você move a dama para g8, dando xeque. O adversário captura a dama com a torre. Você move o cavalo para f7: xeque-mate.");
    expect(en.reveal(smothered).text).toBe("Here is the solution. You move the queen to g8, giving check. Your opponent takes the queen with the rook. You move the knight to f7: checkmate.");
    expect(pt.reveal(smothered, 2).text).toBe("Veja o resto da solução. Você move o cavalo para f7: xeque-mate.");
    expect(en.reveal(smothered, 2).text).toBe("Here is the rest of the solution. You move the knight to f7: checkmate.");
  });

  it("has every fixed line in both languages", () => {
    expect(pt.language).toBe("pt-br");
    expect(en.language).toBe("en");
    expect(pt.text).toMatchObject({ name: "Sofia", role: "Treinadora", takeBack: "Toque no tabuleiro para voltar o lance.", thinking: "Sofia está pensando" });
    expect(en.text).toMatchObject({ name: "Sofia", role: "Coach", takeBack: "Tap the board to take the move back.", thinking: "Sofia is thinking" });
    expect(Object.keys(en.text).sort()).toEqual(Object.keys(pt.text).sort());
    for (const key of Object.keys(pt.text) as (keyof typeof pt.text)[]) {
      expect(en.text[key], key).not.toBe("");
      // Only her name is the same in both.
      if (key !== "name") expect(en.text[key], key).not.toBe(pt.text[key]);
    }
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
