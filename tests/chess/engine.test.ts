import { describe, expect, it } from "vitest";
import { LETTERS_PT, Position, START_FEN, Searcher, boardView, evaluate, isCheckmate, isMateScore, isStalemate, lineToSan, mateIn, matingMoves, moveFromUci, moveToUci, toSan } from "@/games/chess/engine";

function perft(position: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = position.legalMoves();
  if (depth === 1) return moves.length;
  let total = 0;
  for (const move of moves) {
    position.make(move);
    total += perft(position, depth - 1);
    position.unmake(move);
  }
  return total;
}

const play = (position: Position, ...moves: string[]): Position => {
  for (const uci of moves) {
    const move = moveFromUci(position, uci);
    if (move === 0) throw new Error(`illegal fixture move ${uci}`);
    position.make(move);
  }
  return position;
};

describe("move generation", () => {
  // Node counts from the chess programming wiki's perft results. They cover castling, en passant, promotions and pins.
  const cases: [string, string, number[]][] = [
    ["start position", START_FEN, [20, 400, 8902, 197281]],
    ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
    ["en passant pins", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
    ["promotions", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
    ["castling through check", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
  ];
  for (const [name, fen, expected] of cases) {
    it(`counts the moves of the ${name}`, () => {
      const position = Position.fromFen(fen);
      expect(expected.map((_, index) => perft(position, index + 1))).toEqual(expected);
      // Make and unmake left nothing behind, running totals included.
      expect(position.toFen()).toBe(fen);
      expect(evaluate(position)).toBe(evaluate(Position.fromFen(fen)));
    });
  }

  it("round-trips FEN and UCI", () => {
    const position = play(Position.fromFen(START_FEN), "e2e4", "c7c5", "g1f3");
    expect(position.toFen()).toBe("rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
    const promotion = Position.fromFen("8/4P1k1/8/8/8/8/8/4K3 w - - 0 1");
    expect(moveToUci(moveFromUci(promotion, "e7e8n"))).toBe("e7e8n");
    // Without a letter a pawn reaching the last rank becomes a queen.
    expect(moveToUci(moveFromUci(promotion, "e7e8"))).toBe("e7e8q");
    expect(moveFromUci(promotion, "e7e6")).toBe(0);
  });
});

describe("notation", () => {
  it("writes checks, mates, castling and disambiguation", () => {
    const fools = play(Position.fromFen(START_FEN), "f2f3", "e7e5", "g2g4");
    expect(toSan(fools, moveFromUci(fools, "d8h4"))).toBe("Qh4#");
    expect(toSan(fools, moveFromUci(fools, "d8h4"), LETTERS_PT)).toBe("Dh4#");

    const castle = Position.fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(toSan(castle, moveFromUci(castle, "e1g1"))).toBe("O-O");
    expect(toSan(castle, moveFromUci(castle, "e1c1"))).toBe("O-O-O");
    expect(toSan(castle, moveFromUci(castle, "a1a8"))).toBe("Rxa8+");

    const knights = Position.fromFen("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1");
    expect(toSan(knights, moveFromUci(knights, "b1d2"))).toBe("Nbd2");
    expect(toSan(knights, moveFromUci(knights, "f1d2"), LETTERS_PT)).toBe("Cfd2");
  });

  it("numbers a line from either side", () => {
    const white = Position.fromFen(START_FEN);
    expect(lineToSan(white, [moveFromUci(white, "e2e4")])).toBe("1. e4");
    const black = play(Position.fromFen(START_FEN), "e2e4");
    const reply = moveFromUci(black, "e7e5");
    black.make(reply);
    const second = moveFromUci(black, "g1f3");
    black.unmake(reply);
    expect(lineToSan(black, [reply, second])).toBe("1... e5 2. Nf3");
    expect(black.toFen()).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  });
});

describe("search", () => {
  it("recognizes mate and stalemate", () => {
    expect(isCheckmate(play(Position.fromFen(START_FEN), "f2f3", "e7e5", "g2g4", "d8h4"))).toBe(true);
    const stalemate = Position.fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(isStalemate(stalemate)).toBe(true);
    expect(isCheckmate(stalemate)).toBe(false);
  });

  it("finds a back-rank mate in one and nothing else", () => {
    const position = Position.fromFen("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1");
    expect(matingMoves(position, 1, false).map(moveToUci)).toEqual(["e1e8"]);
    expect(mateIn(position, 3)).toBe(1);
    const best = new Searcher().best(position, 2);
    expect(best && moveToUci(best.move)).toBe("e1e8");
    expect(best && isMateScore(best.score)).toBe(true);
  });

  it("proves a smothered mate in two, with and without the checks-only shortcut", () => {
    // Qg8+ forces Rxg8, then Nf7 mates the boxed-in king.
    const position = Position.fromFen("5r1k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1");
    expect(mateIn(position, 1)).toBe(0);
    expect(matingMoves(position, 2, false).map(moveToUci)).toEqual(["b3g8"]);
    expect(matingMoves(position, 2, true).map(moveToUci)).toEqual(["b3g8"]);
    expect(mateIn(position, 3)).toBe(2);
  });

  it("wins a hanging piece and leaves a defended one alone", () => {
    const hanging = Position.fromFen("4k3/8/8/3n4/8/8/3R4/4K3 w - - 0 1");
    expect(moveToUci(new Searcher().best(hanging, 3)!.move)).toBe("d2d5");
    const defended = Position.fromFen("4k3/8/4p3/3n4/8/8/3R4/4K3 w - - 0 1");
    expect(moveToUci(new Searcher().best(defended, 3)!.move)).not.toBe("d2d5");
  });

  it("gives the same answer and the same node count every time", () => {
    const fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
    const run = () => {
      const searcher = new Searcher();
      const best = searcher.best(Position.fromFen(fen), 3)!;
      return `${moveToUci(best.move)} ${best.score} ${searcher.nodes}`;
    };
    expect(run()).toBe(run());
  });
});

describe("board view", () => {
  it("keeps a piece's identity through moves, castling, captures and promotion", () => {
    const fen = "r3k2r/1P6/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const position = Position.fromFen(fen);
    const castle = moveFromUci(position, "e1g1");
    position.make(castle);
    const take = moveFromUci(position, "a8a1");
    position.make(take);
    const promote = moveFromUci(position, "b7b8q");

    const start = boardView(fen, []);
    const idOf = (view: ReturnType<typeof boardView>, square: number) => view.pieces.find((piece) => piece.square === square)?.id;
    const after = boardView(fen, [castle, take, promote]);
    expect(idOf(after, 6)).toBe(idOf(start, 4)); // king e1 -> g1
    expect(idOf(after, 5)).toBe(idOf(start, 7)); // rook h1 -> f1
    expect(idOf(after, 0)).toBe(idOf(start, 56)); // black rook took on a1
    expect(after.pieces.some((piece) => piece.id === idOf(start, 0))).toBe(false); // the white a1 rook is gone
    const queen = after.pieces.find((piece) => piece.square === 57)!;
    expect([queen.id, queen.type]).toEqual([idOf(start, 49), 5]); // the pawn became a queen and kept its id
    expect(after.lastMove).toEqual([49, 57]);
    expect(after.checkSquare).toBe(60);
    expect(start.lastMove).toBeNull();
  });
});
