import { describe, expect, it } from "vitest";
import { type Coach, DIFFICULTIES, type Difficulty, type Feedback, type Move, type MoveForm, Position, type ResolvedPuzzle, START_FEN, coachFor, explainWrongMove, generateChessPuzzle, moveFacts, moveFromUci, positionAfter, resolvePuzzle, toSan } from "@/games/chess/engine";
import { LOCALES } from "@/i18n/config";

const pt = coachFor("pt-br");
const en = coachFor("en");

/** A describer bound to a position: `say(pt, "e2e4", "clause")`. The move has to be legal there. */
function at(fen: string) {
  const position = Position.fromFen(fen);
  const legal = (uci: string): Move => {
    const move = moveFromUci(position, uci);
    if (move === 0) throw new Error(`${uci} is not legal in ${fen}`);
    return move;
  };
  return {
    position,
    legal,
    say: (coach: Coach, uci: string, form: MoveForm, after?: Move) => coach.describeMove(position, legal(uci), form, after),
    /** The position after a move, to describe the answer to it. */
    after: (uci: string) => {
      const move = legal(uci);
      position.make(move);
      const next = at(position.toFen());
      position.unmake(move);
      return { ...next, previous: move };
    },
  };
}

const FORMS: readonly MoveForm[] = ["clause", "infinitive", "past", "pastPlural", "present", "gerund"];

/** After Black's Rf8 in the smothered mate: White's queen is on b3, the knight on h6. */
const SMOTHERED = "5r1k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1";
/** One piece of each kind with a quiet move to make, and no check anywhere. */
const ONE_OF_EACH = "4k3/8/8/8/8/8/4P3/RNBQK3 w - - 0 1";
const CASTLING = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

describe("move describer, Portuguese", () => {
  it("has every verb form of a plain move", () => {
    const { say } = at(SMOTHERED);
    expect(FORMS.map((form) => say(pt, "b3b4", form))).toEqual(["a dama vai para b4", "mover a dama para b4", "moveu a dama para b4", "moveram a dama para b4", "move a dama para b4", "movendo a dama para b4"]);
  });

  it("gives each piece its article", () => {
    const { say } = at(ONE_OF_EACH);
    expect(say(pt, "e2e3", "clause")).toBe("o peão avança para e3");
    expect(say(pt, "b1c3", "clause")).toBe("o cavalo vai para c3");
    expect(say(pt, "c1d2", "clause")).toBe("o bispo vai para d2");
    expect(say(pt, "a1a5", "clause")).toBe("a torre vai para a5");
    expect(say(pt, "d1d5", "clause")).toBe("a dama vai para d5");
    expect(say(pt, "e1f1", "clause")).toBe("o rei vai para f1");
    expect(say(pt, "a1a5", "infinitive")).toBe("mover a torre para a5");
    expect(say(pt, "e1f1", "past")).toBe("moveu o rei para f1");
  });

  it("advances pawns, one square or two", () => {
    const { say } = at(START_FEN);
    expect(FORMS.map((form) => say(pt, "e2e4", form))).toEqual(["o peão avança para e4", "avançar o peão para e4", "avançou o peão para e4", "avançaram o peão para e4", "avança o peão para e4", "avançando o peão para e4"]);
    expect(say(pt, "g1f3", "pastPlural")).toBe("moveram o cavalo para f3");
  });

  it("says what a capture takes, and where", () => {
    const { say } = at("4k3/8/8/3n4/4P3/8/2B5/3RK3 w - - 0 1");
    expect(say(pt, "e4d5", "clause")).toBe("o peão captura o cavalo em d5");
    expect(FORMS.slice(1).map((form) => say(pt, "d1d5", form))).toEqual([
      "capturar o cavalo em d5 com a torre",
      "capturou o cavalo em d5 com a torre",
      "capturaram o cavalo em d5 com a torre",
      "captura o cavalo em d5 com a torre",
      "capturando o cavalo em d5 com a torre",
    ]);
    expect(say(pt, "d1d5", "clause")).toBe("a torre captura o cavalo em d5");
    // The captured piece agrees too: "a torre", "o bispo".
    const trade = at("3rk3/8/8/8/8/8/8/3RK2b w - - 0 1");
    expect(trade.say(pt, "d1d8", "clause")).toBe("a torre captura a torre em d8, dando xeque");
  });

  it("leaves the square out when the capture takes the piece that has just arrived", () => {
    const check = at(SMOTHERED).after("b3g8");
    expect(check.say(pt, "f8g8", "present")).toBe("captura a dama em g8 com a torre");
    expect(check.say(pt, "f8g8", "present", check.previous)).toBe("captura a dama com a torre");
    expect(check.say(pt, "f8g8", "gerund", check.previous)).toBe("capturando a dama com a torre");
    expect(check.say(pt, "f8g8", "clause", check.previous)).toBe("a torre captura a dama");
  });

  it("captures en passant", () => {
    const { say } = at("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(say(pt, "e5d6", "clause")).toBe("o peão captura en passant em d6");
    expect(say(pt, "e5d6", "infinitive")).toBe("capturar o peão en passant em d6");
    expect(say(pt, "e5d6", "past")).toBe("capturou o peão en passant em d6");
    // Two pawns that can both take: the one that does is named by its square.
    const two = at("4k3/8/8/2PpP3/8/8/8/4K3 w - d6 0 1");
    expect(two.say(pt, "c5d6", "clause")).toBe("o peão de c5 captura en passant em d6");
    expect(two.say(pt, "c5d6", "infinitive")).toBe("capturar o peão en passant em d6 com o peão de c5");
  });

  it("castles on both sides", () => {
    const { say } = at(CASTLING);
    expect(FORMS.map((form) => say(pt, "e1g1", form))).toEqual(["o rei faz o roque pequeno", "fazer o roque pequeno", "fez o roque pequeno", "fizeram o roque pequeno", "faz o roque pequeno", "fazendo o roque pequeno"]);
    expect(say(pt, "e1c1", "clause")).toBe("o rei faz o roque grande");
    expect(say(pt, "e1c1", "pastPlural")).toBe("fizeram o roque grande");
    // The rook lands on f1 and looks down the file at the king.
    expect(at("5k2/8/8/8/8/8/8/4K2R w K - 0 1").say(pt, "e1g1", "past")).toBe("fez o roque pequeno, dando xeque");
  });

  it("promotes, with and without a capture", () => {
    const { say } = at("3r2k1/4P3/8/8/8/8/8/4K3 w - - 0 1");
    expect(FORMS.map((form) => say(pt, "e7e8q", form))).toEqual([
      "o peão chega a e8 e vira dama, dando xeque",
      "promover o peão a dama em e8, dando xeque",
      "promoveu o peão a dama em e8, dando xeque",
      "promoveram o peão a dama em e8, dando xeque",
      "promove o peão a dama em e8, dando xeque",
      "promovendo o peão a dama em e8 e dando xeque",
    ]);
    expect(FORMS.map((form) => say(pt, "e7d8q", form))).toEqual([
      "o peão captura a torre em d8 e vira dama, dando xeque",
      "capturar a torre em d8 e promover o peão a dama, dando xeque",
      "capturou a torre em d8 e promoveu o peão a dama, dando xeque",
      "capturaram a torre em d8 e promoveram o peão a dama, dando xeque",
      "captura a torre em d8 e promove o peão a dama, dando xeque",
      "capturando a torre em d8 e promovendo o peão a dama e dando xeque",
    ]);
    // The piece the pawn becomes takes no article: "vira cavalo", "a torre".
    const quiet = at("8/4P1k1/8/8/8/8/8/4K3 w - - 0 1");
    expect(quiet.say(pt, "e7e8q", "clause")).toBe("o peão chega a e8 e vira dama");
    expect(quiet.say(pt, "e7e8n", "clause")).toBe("o peão chega a e8 e vira cavalo, dando xeque");
    expect(quiet.say(pt, "e7e8r", "infinitive")).toBe("promover o peão a torre em e8");
    expect(quiet.say(pt, "e7e8b", "infinitive")).toBe("promover o peão a bispo em e8");
  });

  it("names the square a piece comes from when two of a kind could make the move", () => {
    const rooks = at("6k1/8/8/8/8/8/8/R4RK1 w - - 0 1");
    expect(rooks.say(pt, "a1d1", "clause")).toBe("a torre de a1 vai para d1");
    expect(rooks.say(pt, "f1d1", "infinitive")).toBe("mover a torre de f1 para d1");
    // Only one rook reaches a7, so it needs no origin.
    expect(rooks.say(pt, "a1a7", "clause")).toBe("a torre vai para a7");

    const knights = at("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1");
    expect(knights.say(pt, "b1d2", "clause")).toBe("o cavalo de b1 vai para d2");
    expect(knights.say(pt, "f1d2", "gerund")).toBe("movendo o cavalo de f1 para d2");

    const capture = at("4k3/8/8/8/8/8/6K1/R2b3R w - - 0 1");
    expect(capture.say(pt, "a1d1", "clause")).toBe("a torre de a1 captura o bispo em d1");
    expect(capture.say(pt, "h1d1", "present")).toBe("captura o bispo em d1 com a torre de h1");

    const pawns = at("4k3/8/8/3n4/2P1P3/8/8/4K3 w - - 0 1");
    expect(pawns.say(pt, "c4d5", "clause")).toBe("o peão de c4 captura o cavalo em d5");
    expect(pawns.say(pt, "e4d5", "infinitive")).toBe("capturar o cavalo em d5 com o peão de e4");
    // A rook pinned to its king cannot make the move, so the other one is not ambiguous.
    const pinned = at("4r1k1/8/8/8/8/8/R3R3/4K3 w - - 0 1");
    expect(pinned.say(pt, "a2c2", "clause")).toBe("a torre vai para c2");
  });

  it("ends a move with the check or the mate it gives", () => {
    const start = at(SMOTHERED);
    expect(FORMS.map((form) => start.say(pt, "b3g8", form))).toEqual([
      "a dama vai para g8, dando xeque",
      "mover a dama para g8, dando xeque",
      "moveu a dama para g8, dando xeque",
      "moveram a dama para g8, dando xeque",
      "move a dama para g8, dando xeque",
      "movendo a dama para g8 e dando xeque",
    ]);
    const mate = start.after("b3g8").after("f8g8");
    expect(mate.say(pt, "h6f7", "clause")).toBe("o cavalo vai para f7: xeque-mate");
    expect(mate.say(pt, "h6f7", "infinitive")).toBe("mover o cavalo para f7: xeque-mate");
    expect(mate.say(pt, "h6f7", "present")).toBe("move o cavalo para f7: xeque-mate");
    // A capture that mates on the back rank.
    expect(at("4b1k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1").say(pt, "e1e8", "clause")).toBe("a torre captura o bispo em e8: xeque-mate");
  });
});

describe("move describer, English", () => {
  it("has every verb form of a plain move, with one past for a player and for a side", () => {
    const { say } = at(SMOTHERED);
    expect(FORMS.map((form) => say(en, "b3b4", form))).toEqual(["the queen goes to b4", "move the queen to b4", "moved the queen to b4", "moved the queen to b4", "moves the queen to b4", "moving the queen to b4"]);
  });

  it("names every piece, and the rook is a rook", () => {
    const { say } = at(ONE_OF_EACH);
    expect(say(en, "e2e3", "clause")).toBe("the pawn advances to e3");
    expect(say(en, "b1c3", "clause")).toBe("the knight goes to c3");
    expect(say(en, "c1d2", "clause")).toBe("the bishop goes to d2");
    expect(say(en, "a1a5", "clause")).toBe("the rook goes to a5");
    expect(say(en, "d1d5", "clause")).toBe("the queen goes to d5");
    expect(say(en, "e1f1", "clause")).toBe("the king goes to f1");
  });

  it("advances pawns, one square or two", () => {
    const { say } = at(START_FEN);
    expect(FORMS.map((form) => say(en, "e2e4", form))).toEqual(["the pawn advances to e4", "advance the pawn to e4", "advanced the pawn to e4", "advanced the pawn to e4", "advances the pawn to e4", "advancing the pawn to e4"]);
  });

  it("says what a capture takes, and where", () => {
    const { say } = at("4k3/8/8/3n4/4P3/8/2B5/3RK3 w - - 0 1");
    expect(say(en, "e4d5", "clause")).toBe("the pawn takes the knight on d5");
    expect(FORMS.map((form) => say(en, "d1d5", form))).toEqual([
      "the rook takes the knight on d5",
      "take the knight on d5 with the rook",
      "took the knight on d5 with the rook",
      "took the knight on d5 with the rook",
      "takes the knight on d5 with the rook",
      "taking the knight on d5 with the rook",
    ]);
  });

  it("leaves the square out when the capture takes the piece that has just arrived", () => {
    const check = at(SMOTHERED).after("b3g8");
    expect(check.say(en, "f8g8", "present")).toBe("takes the queen on g8 with the rook");
    expect(check.say(en, "f8g8", "present", check.previous)).toBe("takes the queen with the rook");
    expect(check.say(en, "f8g8", "gerund", check.previous)).toBe("taking the queen with the rook");
  });

  it("captures en passant", () => {
    const { say } = at("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(say(en, "e5d6", "clause")).toBe("the pawn takes en passant on d6");
    expect(say(en, "e5d6", "infinitive")).toBe("take the pawn en passant on d6");
    const two = at("4k3/8/8/2PpP3/8/8/8/4K3 w - d6 0 1");
    expect(two.say(en, "c5d6", "clause")).toBe("the pawn on c5 takes en passant on d6");
    expect(two.say(en, "e5d6", "past")).toBe("took the pawn en passant on d6 with the pawn on e5");
  });

  it("castles on both sides", () => {
    const { say } = at(CASTLING);
    expect(FORMS.map((form) => say(en, "e1g1", form))).toEqual(["the king castles kingside", "castle kingside", "castled kingside", "castled kingside", "castles kingside", "castling kingside"]);
    expect(say(en, "e1c1", "clause")).toBe("the king castles queenside");
    expect(say(en, "e1c1", "past")).toBe("castled queenside");
    expect(at("5k2/8/8/8/8/8/8/4K2R w K - 0 1").say(en, "e1g1", "past")).toBe("castled kingside, giving check");
  });

  it("promotes, with and without a capture", () => {
    const { say } = at("3r2k1/4P3/8/8/8/8/8/4K3 w - - 0 1");
    expect(FORMS.map((form) => say(en, "e7e8q", form))).toEqual([
      "the pawn reaches e8 and becomes a queen, giving check",
      "promote the pawn to a queen on e8, giving check",
      "promoted the pawn to a queen on e8, giving check",
      "promoted the pawn to a queen on e8, giving check",
      "promotes the pawn to a queen on e8, giving check",
      "promoting the pawn to a queen on e8 and giving check",
    ]);
    expect(FORMS.map((form) => say(en, "e7d8q", form))).toEqual([
      "the pawn takes the rook on d8 and becomes a queen, giving check",
      "take the rook on d8 with the pawn and promote it to a queen, giving check",
      "took the rook on d8 with the pawn and promoted it to a queen, giving check",
      "took the rook on d8 with the pawn and promoted it to a queen, giving check",
      "takes the rook on d8 with the pawn and promotes it to a queen, giving check",
      "taking the rook on d8 with the pawn and promoting it to a queen and giving check",
    ]);
    const quiet = at("8/4P1k1/8/8/8/8/8/4K3 w - - 0 1");
    expect(quiet.say(en, "e7e8n", "clause")).toBe("the pawn reaches e8 and becomes a knight, giving check");
    expect(quiet.say(en, "e7e8r", "infinitive")).toBe("promote the pawn to a rook on e8");
  });

  it("names the square a piece comes from when two of a kind could make the move", () => {
    const rooks = at("6k1/8/8/8/8/8/8/R4RK1 w - - 0 1");
    expect(rooks.say(en, "a1d1", "clause")).toBe("the rook on a1 goes to d1");
    expect(rooks.say(en, "f1d1", "infinitive")).toBe("move the rook on f1 to d1");
    expect(rooks.say(en, "a1a7", "clause")).toBe("the rook goes to a7");
    const capture = at("4k3/8/8/8/8/8/6K1/R2b3R w - - 0 1");
    expect(capture.say(en, "a1d1", "clause")).toBe("the rook on a1 takes the bishop on d1");
    expect(capture.say(en, "h1d1", "present")).toBe("takes the bishop on d1 with the rook on h1");
    const pawns = at("4k3/8/8/3n4/2P1P3/8/8/4K3 w - - 0 1");
    expect(pawns.say(en, "c4d5", "clause")).toBe("the pawn on c4 takes the knight on d5");
  });

  it("ends a move with the check or the mate it gives", () => {
    const start = at(SMOTHERED);
    expect(FORMS.map((form) => start.say(en, "b3g8", form))).toEqual([
      "the queen goes to g8, giving check",
      "move the queen to g8, giving check",
      "moved the queen to g8, giving check",
      "moved the queen to g8, giving check",
      "moves the queen to g8, giving check",
      "moving the queen to g8 and giving check",
    ]);
    const mate = start.after("b3g8").after("f8g8");
    expect(mate.say(en, "h6f7", "clause")).toBe("the knight goes to f7: checkmate");
    expect(mate.say(en, "h6f7", "infinitive")).toBe("move the knight to f7: checkmate");
    expect(at("4b1k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1").say(en, "e1e8", "clause")).toBe("the rook takes the bishop on e8: checkmate");
  });
});

describe("move facts", () => {
  it("reads a move and leaves the position alone", () => {
    const { position, legal } = at("3r2k1/4P3/8/8/8/8/8/4K3 w - - 0 1");
    const fen = position.toFen();
    expect(moveFacts(position, legal("e7d8q"))).toEqual({ piece: 1, from: 52, to: 59, captured: 4, enPassant: false, promotion: 5, castle: null, ambiguous: false, recapture: false, check: true, mate: false });
    expect(position.toFen()).toBe(fen);
    const castle = at(CASTLING);
    expect(moveFacts(castle.position, castle.legal("e1c1"))).toMatchObject({ piece: 6, castle: "queen", captured: 0, check: false });
    const passing = at("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(moveFacts(passing.position, passing.legal("e5d6"))).toMatchObject({ enPassant: true, captured: 1, recapture: false });
  });
});

describe("gender agreement in the Portuguese coach", () => {
  const wrong = (fen: string, uci: string, variant: number) => {
    const { position, legal } = at(fen);
    const move = legal(uci);
    const feedback = explainWrongMove(position, move, "advantage", 0);
    expect(feedback.kind, `${uci} in ${fen}`).toBe("loses-material");
    return pt.wrong(position, move, feedback, variant).text;
  };

  it("agrees the lost piece and the piece that takes it", () => {
    // A knight walks into the queen, and a queen walks into a bishop.
    const knight = "4k3/8/8/8/8/2q5/8/1N4K1 w - - 0 1";
    expect(wrong(knight, "b1d2", 0)).toBe("E o seu cavalo? Em d2, ele é capturado pela dama.");
    expect(wrong(knight, "b1d2", 1)).toBe("Opa, o seu cavalo ficou sem proteção em d2. O adversário captura com a dama.");
    const queen = "4k3/8/5b2/8/8/8/8/3QK3 w - - 0 1";
    expect(wrong(queen, "d1d4", 0)).toBe("E a sua dama? Em d4, ela é capturada pelo bispo.");
    expect(wrong(queen, "d1d4", 1)).toBe("Opa, a sua dama ficou sem proteção em d4. O adversário captura com o bispo.");
  });

  it("agrees the piece that moved and the one left behind", () => {
    // The bishop steps away and the rook behind it is taken.
    const text = wrong("3rk3/8/8/8/8/8/3B4/3R2K1 w - - 0 1", "d2e3", 0);
    expect(text).toBe("Você moveu o bispo, mas e a sua torre? O adversário captura a torre em d1 com a torre, dando xeque.");
  });
});

/** Notation in any of its shapes: a piece letter stuck to a square, a capture sign, a check or mate sign, castling. */
const NOTATION: readonly RegExp[] = [/\b[KQRBNTDCR]?[a-h]?x?[a-h][1-8][+#]/, /\b[KQRBNTDC][a-h1-8]?x?[a-h][1-8]\b/, /\b[a-h]x[a-h][1-8]\b/, /[a-h][1-8]=[QRBNDTC]/, /O-O|0-0/, /[+#]/];

describe("the coach never speaks in notation", () => {
  // CHESS_BULK widens the batch, as it does for the generator's bulk test.
  const bulk = Number(process.env.CHESS_BULK ?? 0) > 0;
  const seeds = bulk ? 12 : 2;
  /** One wrong move in `stride` is analysed. Each costs a search, and both languages reuse the result. */
  const stride = bulk ? 1 : 3;
  /** A material win whose wrong moves include a small capture and a move that gets mated. Every one of them is analysed. */
  const MATERIAL = { seed: "readme-9", difficulty: "medium" } as const;

  type Step = { position: Position; move: Move; reply: Move | undefined; index: number; wrong: { move: Move; feedback: Feedback }[] };
  type Case = { resolved: ResolvedPuzzle; steps: Step[] };
  let batch: Case[] | null = null;
  /** Puzzles of every tier, with each solver move and the analysis of the wrong moves around it. Built once. */
  const cases = (): Case[] => {
    if (batch) return batch;
    const built: Case[] = [];
    const add = (seed: string, difficulty: Difficulty, every: number) => {
      const puzzle = generateChessPuzzle(seed, difficulty);
      const resolved = resolvePuzzle(puzzle);
      const steps: Step[] = [];
      for (let index = 0; index < resolved.line.length; index += 2) {
        const position = positionAfter(resolved, resolved.line.slice(0, index));
        const move = resolved.line[index];
        const remaining = puzzle.mateIn > 0 ? puzzle.mateIn - index / 2 : 0;
        const others = position.legalMoves().filter((other, at) => other !== move && at % every === 0);
        steps.push({ position, move, reply: resolved.line[index + 1], index, wrong: others.map((other) => ({ move: other, feedback: explainWrongMove(position, other, puzzle.kind, remaining) })) });
      }
      built.push({ resolved, steps });
    };
    for (const difficulty of DIFFICULTIES) for (let seed = 0; seed < seeds; seed++) add(`coach-${seed}`, difficulty, stride);
    add(MATERIAL.seed, MATERIAL.difficulty, 1);
    batch = built;
    return built;
  };

  for (const language of LOCALES) {
    it(`${language}: every message of a batch of puzzles is plain words`, { timeout: 120_000 }, () => {
      const coach = coachFor(language);
      const said: string[] = [];
      /** What was said without being allowed to give the solution away, next to the move it must not tell. */
      const guarded: { text: string; move: Move; position: Position }[] = [];
      const kinds = new Set<string>();

      for (const { resolved, steps } of cases()) {
        said.push(coach.intro(resolved).text);
        for (const { position, move, reply, index, wrong } of steps) {
          const hint = coach.pieceHint(resolved, move).text;
          said.push(hint, coach.moveHint(position, move).text, coach.reveal(resolved, index).text);
          guarded.push({ text: hint, move, position });
          for (let variant = 0; variant < 4; variant++) {
            said.push(reply === undefined ? coach.solved(resolved, position, move, variant).text : coach.praise(position, move, reply, variant).text);
          }
          for (const { move: other, feedback } of wrong) {
            kinds.add(feedback.kind);
            for (const variant of [0, 1]) {
              const text = coach.wrong(position, other, feedback, variant).text;
              said.push(text);
              guarded.push({ text, move, position });
            }
          }
        }
      }

      for (const reason of ["in-check", "exposes-king", "unreachable"] as const) for (let piece = 1; piece <= 6; piece++) said.push(coach.illegal(reason, piece, 28));
      said.push(coach.takeBackHint().text, ...Object.values(coach.text));

      // The batch is wide enough to reach every kind of comment on a wrong move.
      expect([...kinds].sort()).toEqual(["check-answered", "loses-material", "mated", "misses", "slower-mate", "small-gain", "too-slow"]);
      expect(said.length).toBeGreaterThan(500);
      for (const text of said) {
        for (const pattern of NOTATION) expect(text, text).not.toMatch(pattern);
        // House style: no em dash, no stray spaces, and no value that leaked into a sentence.
        expect(text, text).not.toContain("\u2014");
        expect(text, text).not.toMatch(/\s{2}|\s[.,:!?]|undefined|null|NaN/);
      }
      // The teaching rule. A hint or a comment on a wrong move never tells the move to find, in any of its wordings.
      for (const { text, move, position } of guarded) {
        for (const form of FORMS) expect(text, `${toSan(position, move)}: ${text}`).not.toContain(coach.describeMove(position, move, form));
      }
    });
  }

  it("says the same things in both languages, sentence for sentence", () => {
    const resolved = resolvePuzzle(generateChessPuzzle("coach-0", "medium"));
    const sentences = (text: string) => text.split(/(?<=[.!?])\s/).length;
    expect(sentences(en.intro(resolved).text)).toBe(sentences(pt.intro(resolved).text));
    expect(sentences(en.reveal(resolved).text)).toBe(sentences(pt.reveal(resolved).text));
    expect(en.intro(resolved).mood).toBe(pt.intro(resolved).mood);
  });
});
