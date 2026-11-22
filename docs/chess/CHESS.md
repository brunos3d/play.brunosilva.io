# Chess

Chess is a tactics puzzle in the manner of the chess.com and Lichess puzzles: the opponent makes a mistake and the player has to punish it, or the opponent makes a threat and one move holds. Every puzzle is generated on the device from a seed. This document covers the engine, the generator, the coach and the board. Platform features it shares with the other games (clock, hints, reveal, results, storage, offline) are in `docs/ARCHITECTURE.md`, seeds and daily puzzles are in `docs/SEEDS.md`, and the research behind the design is in `docs/chess/RESEARCH.md`.

## A puzzle

```ts
type ChessPuzzle = {
  id: string; seed: string; version: number; difficulty: Difficulty;
  fen: string;        // position before the opponent's last move
  setup: string;      // that move, in UCI form: "g2g4"
  line: string[];     // the solution after it: solver, opponent, solver. Ends on a solver move
  solver: "white" | "black";
  kind: "mate" | "advantage" | "defence";
  mateIn: number;     // solver moves until mate, 0 when it is not a mate
  themes: ChessTheme[];
  metadata: ChessMetadata;   // recipe, games mined, half-move, nodes, gain, pieces
};
```

There are three kinds:

- **mate**: a forced checkmate in 1, 2 or 3 moves.
- **advantage**: a line of 1 or 2 moves that wins material, ending on the capture or the promotion.
- **defence**: the opponent made a threat and exactly one move keeps the position together.

The stored position is the one before the opponent's last move. The board opens on it, plays that move after half a second, and only then takes input. The player sees what the opponent did, which is where the solution usually starts.

## Engine

The engine is pure TypeScript under `engine/`, about 950 lines for the rules and the search. It has no dependency and runs in plain Node, which is how the tests and the command-line tools use it.

### Position (`position.ts`)

A position is one `Int8Array` of 64 squares, a1 = 0 to h8 = 63. A piece is `type | (colour << 3)`. A move is one integer that packs from, to, promotion, a flag (double push, en passant, castling), the captured type and the moving type, so the search can order moves and the coach can describe them without the board.

`make` and `unmake` change the board in place and keep an undo stack. They also keep two running totals: material plus placement of every piece, and each side's material without pawns. Evaluation is then a few additions.

`legalMoves` generates pseudo-legal moves and filters them. Most need no test: with the king not in check, a piece that shares no rank, file or diagonal with it cannot expose it. Only king moves, en passant, moves along the king's lines and moves made in check are played out and checked.

Move generation is checked against published perft counts for five positions that cover castling, en passant, promotions and pins (`tests/chess/engine.test.ts`).

### Search (`search.ts`)

The search answers three questions a few moves deep: is there a forced mate, how much material does the best line win, and is the best move the only good one.

- **Evaluation** is material (100, 320, 330, 500, 900) plus Tomasz Michniewski's piece-square tables. Kings switch to a centre-seeking table when each side has 1,300 or less in pieces.
- **Alpha-beta** searches a fixed number of plies and then captures only (quiescence), so a line never stops in the middle of an exchange. A check at the horizon gets one more ply.
- **Quiescence** skips two kinds of capture: taking a cheaper piece that a pawn defends, and taking something too small to bring the score back to alpha. That cut the tree to a third.
- **Budgets are in nodes**, never in milliseconds. A slow phone finds the same puzzle as a fast desktop.

Mates use their own search, `matingMoves(position, moves, checksOnly)`, which returns every first move that forces mate within `moves` moves. It has two modes:

- `checksOnly`: the mating side only tries checks. A geometric test (`mayGiveCheck`) discards most moves without playing them. This is cheap enough to run on every legal move of every position of a game.
- exact: the mating side tries everything. The defence that refuted the last try is tried first on the next one, which makes most refutations one move long. This form proves a candidate before it becomes a puzzle.

## Generator

`generateChessFromSpec(spec)` builds the puzzle for a seed. It is a pure function of the spec: the PRNG is keyed by token, version and difficulty, every game has its own stream, and all search budgets are node counts.

### Mining a game (`generator/mine.ts`)

A puzzle comes out of a game, as on Lichess. The difference is that the game is played here, by the engine against itself, from the starting position:

1. Both sides follow one policy: take the move with the best score after captures are resolved, plus up to 24 centipawns of seeded noise. That is a player who never leaves a piece hanging in one move and never sees a two-move tactic.
2. The game runs for a number of half-moves drawn from the tier's range before anything is looked for. Later starts mean fewer pieces.
3. From then on every position is probed: is there a move for the side to play that the other side can punish the way the recipe asks? If so, that move becomes the puzzle's opening move.
4. If not, the game goes on with the policy move, so it stays balanced.

Because the game starts from the initial position and every move is legal, every puzzle position is reachable in a real game. The probe also keeps the mistake believable: for mates it tries the most natural moves first, and for two-move wins it only tries moves that look fine one ply deep.

A game that gives nothing is dropped and another one starts, up to 5 games per recipe. Positions with fewer than 10 pieces are not used.

### Recipes (`config.ts`)

A recipe is one way of mining: a kind, a number of solver moves and a search depth. The seed draws one recipe of its tier, weighted, and the others are fallbacks in a seeded order.

| Tier | Recipes (weight) | Solver moves |
|---|---|---|
| easy | mate in 1 (5), win in 1 (5) | 1 |
| medium | mate in 2 (5), win in 2 (4), defence (1.5) | 1 to 2 |
| hard | mate in 3 (5), win in 2 (2.5), sharp mate in 2 (1.5), defence (1) | 1 to 3 |
| expert | sharp mate in 3 (6), mate in 3 (1) | 3 |

A "sharp" mate needs several checks to choose from on the first move (4 for mate in 2, 3 for mate in 3), or a sacrifice in the line. More candidate checks is what makes a forced mate hard to see.

After a tier's own recipes come three that hit in most games (mate in 2, mate in 1, win in 1, 30 games each), so every seed ends with a puzzle. In a 150-puzzle benchmark one expert seed fell through to them.

### What makes a line a puzzle (`generator/cook.ts`)

The rules follow the idea behind the Lichess generator: one clearly best move at every solver move, the best defence at every opponent move. The thresholds are this engine's own.

**Mate.** The exact search must show a mate in exactly N moves and no faster one. At every solver move before the last, one move must be the only one that still mates in time. The opponent answers with the defence that lasts longest. On the last move of a longer puzzle several mates may exist, and the game accepts any of them: a puzzle cannot fault a checkmate. A mate in 1 must have a single mate.

**Advantage.** `base` is the solver's score if the opponent had played its best move instead of the mistake. It has to be within 150 centipawns of equal, so nobody was already winning. Then, at each solver move, searched 3 plies deep:

- the best move must win at least 250 over `base` (a minor piece is 320),
- no other move may come within 200 of it, and no other move may win 200 by itself,
- the line stops when that fails, and it must end on a capture or a promotion, so the player sees what was won.

Lichess compares win chances on a logistic curve. With an evaluation that is almost pure material, fixed margins say the same thing and are easier to reason about.

**Defence.** The opponent plays the policy move, the one the game would play anyway. The puzzle exists when the solver's best move keeps the score within 100 of `base`, is not itself a winning shot, and every other move loses at least 250. Recaptures are left out. Three shallow searches rule out most positions before the full analysis: with one saving move, at most one of any three moves holds.

In all three kinds the solver must have at least 3 legal moves on the first move.

### Themes (`generator/themes.ts`)

After a line is found, a tagger names what happens in it: `mateIn1` to `mateIn3`, `backRankMate`, `smotheredMate`, `sacrifice`, `fork`, `discoveredAttack`, `hangingPiece`, `promotion`, `defensiveMove`. Themes do not select puzzles. They word the coach's first hint and show in the debug panel.

### Validation

`validateChessPuzzle` is an independent check used by the tests and by `npm run chess:validate`. It replays every move for legality and, for mates, proves again with the exact search that the mate takes the stated number of moves and that each solver move before the last is the only one.

### Benchmark

150 puzzles per tier on a desktop (`npm run chess:benchmark -- --count 150`):

| Tier | Mean | p50 | p95 | Max | Games per puzzle | Recipes |
|---|---|---|---|---|---|---|
| easy | 36 ms | 34 | 79 | 99 | 1.2 | mate1 80, win1 70 |
| medium | 169 ms | 119 | 449 | 776 | 3.1 | mate2 86, win2 52, defence 12 |
| hard | 237 ms | 195 | 593 | 968 | 3.4 | mate3 91, mate2 26, win2 26, defence 7 |
| expert | 267 ms | 206 | 605 | 1,317 | 2.6 | mate3 149, mate2 1 |

All 600 puzzles passed the validator and no position repeated. White and Black are the solver about equally often.

Generation runs on the main thread behind the loading board, like the other games. The slow tail on expert is the reason there is no mate in 4: the exact uniqueness proof grows by a factor of about 35 per move. A Web Worker would lift that limit, and the generator can move into one unchanged.

### What was tried and dropped

- **Three-move material wins.** They need a 5-ply search at every probe. 60 games gave no hit inside the node budget.
- **A 4-ply analysis for hard tiers.** It cost seven times more per puzzle than 3 plies and found the same lines.
- **An attacking bias in self-play** (a bonus for moving pieces toward the enemy king). Mate hit rates moved by less than the noise between runs.

## Playing

### State (`engine/game/state.ts`)

The game state is small because the position follows from the puzzle:

```ts
type ChessState = {
  progress: number;          // solution half-moves on the board
  wrong: { move, reply } | null;   // a wrong move waiting to be taken back
  finish: Move | null;       // a different mate the player found on the last move
  status: "playing" | "solved";
  moves: number; mistakes: number; hintsUsed: number; hintStage: 0 | 1; revealed: boolean;
};
```

- A right move advances `progress`, and the opponent's reply follows after a pause.
- A wrong move is legal chess, so it is played. It stays on the board, marked with a cross, and is counted as a mistake. Nothing else can be played until it is taken back, with a tap on the board or with Undo.
- An illegal move changes nothing. The board shakes and the coach names the reason: the king is in check, the move would expose the king, or the piece cannot go there.
- Undo takes back a wrong move first, and otherwise one full move: the player's move and the reply.
- Reset returns to the position after the opponent's opening move. The clock and the counters survive.
- Hint is counted and comes in two steps, as on chess.com's Daily Puzzle. The first shows which piece moves and names the idea. The second plays the move. With a wrong move on the board, a hint takes it back.
- Reveal plays the rest of the line, one half-move every 0.8 s, and the puzzle ends as revealed.

The result screen reports wrong moves under "Mistakes". "Flawless" means none and no hint.

### The coach (`engine/coach/`)

The coach is the one part of the platform that speaks Portuguese. All of her text is in `coach/messages.ts`, with moves in Portuguese notation (R, D, T, B, C).

`feedback.ts` works out why a wrong move is wrong, as data:

| Feedback | Meaning | On the board |
|---|---|---|
| `mated` | the opponent now has a forced mate in 1 or 2 | the mating move is played |
| `loses-material` | the opponent's best reply wins at least 200 | the reply is played |
| `check-answered` | mate puzzle: a check that is met, and the attack is over | nothing |
| `too-slow` | mate puzzle: a quiet move | nothing |
| `slower-mate` | still a forced mate, one move later than the solution | nothing |
| `small-gain` | a capture worth far less than the solution | nothing |
| `misses` | nothing is lost, but the chance is gone | nothing |

The analysis is a 2-ply search after the wrong move, plus the exact mate search, capped at 80,000 nodes. It takes a few milliseconds.

`messages.ts` turns the data into a sentence. It says what the move allows or misses, and it names the piece that is lost: "Você moveu o cavalo, mas e a sua torre? O adversário captura em e8 com Txe8+." It never names the move to find. A test checks that no wrong-move message contains the solution's notation. The second hint and the reveal are the two places where the solution is written out, because that is their job.

Wording varies with a counter kept by the caller, so the same game always reads the same and tests can pin the text.

### Board (`components/board/chess-board.tsx`)

The board is a DOM grid on the shared tile board, like the other games, with the tiles made flush and square.

- **Two ways to move.** Drag a piece, or tap it and then tap the square. A press becomes a drag after 5 px.
- **Marks.** The selected piece's targets show as dots, and as rings around pieces it can take. The last move and the selection are tinted yellow, the king in check sits on a red glow, a hint is a pulsing ring, and the coach's verdict is a tick or a cross on the corner of the square. None of these relies on colour alone.
- **Animation.** Pieces keep an identity between positions (`boardView` tracks each piece from its starting square), so a move is the same element sliding to a new place over 200 ms, forwards and backwards. A piece dropped by hand skips the slide, since it is already there. A captured piece fades instead of vanishing under the capturer.
- **Dragging.** The piece on the board dims and a copy follows the pointer. The copy is rendered into `document.body`, because the board clips its content and is a containment context, which would trap a fixed element. On touch screens the copy rides above the finger.
- **Promotion.** A pawn reaching the last rank opens a column of four pieces over the target square. A press anywhere else cancels.
- **Orientation.** The solver's colour is at the bottom. Coordinates are drawn inside the edge squares.
- **Keyboard.** Arrow keys move a cursor, Enter or Space picks the piece and then the square, Escape lets go.
- The squares keep their green and cream in both themes, because the pieces are drawn for them.

### The coach's panel (`components/coach/`)

The panel takes the place of the status line through `GameFrame`'s `statusSlot`. On a phone it sits under the board with the coach's avatar and her latest line. From 1,000 px of width it moves beside the board and keeps the whole conversation, as a chat. `chess.css` does both with `:has(.chess-coach)` on the shared shell, so no other game is affected.

The avatar is an owl, Sofia. Her eyes and brows follow the mood of the last line (calm, happy, worried, thinking), and each bubble carries a stripe in the same sense for people who cannot read the drawing.

A visually hidden line with `data-testid="game-status"` carries the latest status, as the status line does in the other games.

### Storage (`storage/progress.ts`)

The snapshot stores how far the player got, the counters, the clock and, if there is one, the different mating move that ended the puzzle. The position is not stored. On load the data is treated as untrusted: progress has to fit the line, a solved board must carry a final time, and a stored finishing move has to be legal and has to be checkmate. A wrong move on the board is never stored.

## Tools

```
npm run chess:generate -- --seed 12345 --difficulty hard [--solution] [--json]
npm run chess:validate -- [--count 100] [--from 2026-11-22 --days 365]
npm run chess:benchmark -- [--count 200]
```

`CHESS_BULK=100` raises the number of puzzles the bulk generation test builds per tier.

## Piece artwork

The pieces in `components/board/pieces.tsx` and the knight in the game's icon are the "Cburnett" chess set by Colin M.L. Burnett, published on [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces) under several licences at the user's choice. This project uses them under the 3-clause BSD licence:

```
Copyright (c) Colin M.L. Burnett. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the author nor the names of its contributors may be used
   to endorse or promote products derived from this software without specific
   prior written permission.

THIS SOFTWARE IS PROVIDED BY THE AUTHOR "AS IS" AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT
OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY
OF SUCH DAMAGE.
```
