# Research notes: chess puzzles, Queens and libraries

These notes were collected in November 2026, before Chess and Queens were built. They record how the reference products work, what was copied from them, what was left out and why. Each fact links to where it came from. Anything marked "unverified" could not be confirmed from an official or primary source.

The design that came out of these notes is in `docs/chess/CHESS.md` and `docs/queens/QUEENS.md`.

## chess.com puzzles

### Modes

chess.com has five puzzle modes ([help article](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)):

| Mode | How it works |
|---|---|
| Rated Puzzles | One puzzle at a time. The puzzle rating rises on a solve and falls on a fail, scaled by the puzzle's rating against the player's. |
| Puzzle Rush | 3 or 5 minutes, puzzles get harder, three wrong puzzles end the run. Survival has no clock and the same three strikes. It does not touch the puzzle rating. |
| Puzzle Battle | A 3-minute rush against another player, with its own rating. |
| Daily Puzzle | The same puzzle for everyone, new at local midnight. |
| Custom Puzzles | No clock and no rating. The player picks themes and a rating range. |

Free accounts get 3 rated puzzles, one Rush and one Battle per day.

### Rated puzzles

- After a puzzle the panel shows the puzzle rating, a target time, a speed bonus "awarded based on how close you get to the target time", the pass rate, the attempts and the themes ([help article](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)).
- The rating system was rebuilt in 2025 with "Glicko-style rating logic". Difficulty can be Standard, Hard or Extra Hard ([announcement](https://www.chess.com/news/view/announcing-new-puzzles-rating-system)).
- "Using a Hint counts as a failed attempt, just like making an incorrect move" ([ratings help](https://support.chess.com/en/articles/8602396-how-do-puzzle-ratings-work)).

### Daily Puzzle

The Daily Puzzle is the closest model for this site ([help article](https://support.chess.com/en/articles/8708990-how-does-the-daily-puzzle-work), [lives announcement](https://www.chess.com/news/view/announcing-daily-puzzle-lives-system)):

- The player has 5 hearts. A wrong move or a hint costs one, and the puzzle goes on.
- Hints come in two steps: "The first highlights the piece to move, and the second shows you the correct move".
- With no hearts left the player keeps solving and the day still counts for the streak.
- A coach reacts to moves, gives a tip on each lost heart and warns on the last one. "Hard Mode" hides the tips.
- The streak needs the puzzle finished within 48 hours of its release.

### Unverified

- That the opponent's last move is animated before the player moves. Lichess documents this for its own puzzles (see below), and it is how this site does it.
- Retry and "show solution" buttons after a failed rated puzzle.
- The exact feedback strings.
- The current theme list. The help article does not print it.

## How Lichess generates puzzles

chess.com does not publish how its puzzles are made. Lichess does, and its generator is open source ([lichess-puzzler](https://github.com/ornicar/lichess-puzzler)). It is AGPL-3.0, so it was read for its ideas and none of its code was copied.

- **Source.** Stockfish runs over games played on Lichess. The blog post says the set was made with "Stockfish 12 NNUE using 40 meganodes per position" and that each puzzle has "a single, crystal-clear solution" ([blog](https://lichess.org/@/lichess/blog/new-puzzles-are-here/X-S6gRUA)).
- **Win chances.** Evaluations are compared on a logistic curve, `2 / (1 + exp(-0.00368208 * centipawns)) - 1`, so a pawn matters more in an equal position than in a won one. Mate scores map to 1 and -1 ([util.py](https://github.com/ornicar/lichess-puzzler/blob/master/generator/util.py)).
- **Candidates** ([generator.py](https://github.com/ornicar/lichess-puzzler/blob/master/generator/generator.py)):
  - A position is skipped when the side to move has fewer than 2 legal moves, when the evaluation was already above +300 before the last move, or when that side is already up material.
  - An advantage puzzle needs an evaluation of at least +200 and a jump in win chances above 0.6 against the previous move.
  - A mate puzzle needs a forced mate within 15 moves.
  - The puzzle starts one move earlier, with the opponent's blunder. The trigger is the swing that move caused, so the stored position comes before it.
- **Only-move rule.** A solver move is accepted when it is the only legal move or when `win_chances(best) > win_chances(second) + 0.7`. A mate in 1 with several mates is accepted only if the best move that does not mate is poor.
- **Where the line ends.** Mate lines run to checkmate. Advantage lines stop when the only-move test fails. Trailing moves are trimmed so the line ends on a solver move, and one-move advantage puzzles are dropped.
- **Themes.** A separate tagger names what happens in the line ([cook.py](https://github.com/ornicar/lichess-puzzler/blob/master/tagger/cook.py)). The list ([puzzleTheme.xml](https://github.com/lichess-org/lila/blob/master/translation/source/puzzleTheme.xml)) has motifs (fork, pin, skewer, discovered attack, hanging piece, trapped piece, deflection, attraction, sacrifice, quiet move, defensive move, promotion), mates (mate in 1 to 5, back rank, smothered, Anastasia, Arabian, Boden and more), lengths (one move, short, long, very long) and game phases.
- **Database.** 6,193,530 puzzles under CC0 ([database](https://database.lichess.org/#puzzles)). Each row is `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate`. "FEN is the position before the opponent makes their move", and "the second move is the beginning of the solution".

## What Chess on this site takes from both

| Idea | Source | Here |
|---|---|---|
| The puzzle opens with the opponent's last move | Lichess | Same. The stored position comes before it, and the board plays it when the puzzle opens. |
| One clearly best move per solver move | Lichess | Same idea, with this engine's own thresholds in centipawns (see `docs/chess/CHESS.md`). |
| Puzzles mined from games | Lichess | The games are played on the device by a small engine against itself, from the starting position, under a seed. |
| A wrong move costs something and the puzzle goes on | chess.com Daily | A wrong move is counted and shown in the result. There are no hearts. |
| Two-step hint: the piece, then the move | chess.com Daily | Same, and both steps are counted. |
| A coach that reacts to moves | chess.com Daily | The coach names what a wrong move allows, in Portuguese, and never the move to find. |
| Themes | Lichess | A short list, used to word the hints: mate in 1 to 3, back-rank mate, smothered mate, sacrifice, fork, discovered attack, hanging piece, promotion, defensive move. |
| Ratings, Rush, Battle | chess.com | Not built. Tiers and the daily schedule do the job a rating does elsewhere. |

### Ideas for later

- **Puzzle Rush.** A timed run through puzzles of rising difficulty, three strikes. The generator is fast enough on easy and medium (40 and 170 ms) to build the next puzzle while the current one is played.
- **Themed practice.** The seed already draws a recipe. A theme picker would fix the recipe instead.
- **A rating.** A Glicko-style number per player needs a rating per puzzle, which generated puzzles do not have. Solve statistics per recipe could stand in for it.
- **The Lichess database as a second source.** It is CC0, with ratings and themes. It would be a downloaded file, not a generator, which changes the offline and bundle-size story.
- **Mate in 4 and 5.** The exact proof of uniqueness gets too slow for the main thread past mate in 3. A Web Worker would lift that limit.

## LinkedIn Queens

- **Rules.** Exactly one queen in every row, every column and every coloured region. Queens cannot touch, diagonals included. Two queens that do not touch may share a diagonal ([LinkedIn help](https://www.linkedin.com/help/linkedin/answer/a6269510), [rules write-up](https://mspiegel.github.io/queens-without-backtracking/QUEENS.html)).
- **Controls.** "Click or tap on cells to toggle between empty cells, marked symbol, and Crown symbol" ([LinkedIn help](https://www.linkedin.com/help/linkedin/answer/a6269510)).
- **Aids.** A setting marks the cells a placed queen rules out. Another highlights violations: "If too many Crown symbols are placed, affected cells are marked with red stripes." Hint highlights a region where a queen must go, or flags wrong placements. Undo removes the last placement and Clear wipes the board (same page).
- **Schedule.** A new puzzle at midnight Pacific Time ([LinkedIn help](https://www.linkedin.com/help/linkedin/answer/a6863543)).
- **Sizes.** 7x7 to 11x11. In an archive of 668 puzzles: 112 of 7x7, 256 of 8x8, 194 of 9x9, 74 of 10x10 and 32 of 11x11 ([rules write-up](https://mspiegel.github.io/queens-without-backtracking/QUEENS.html)).
- **Solving by deduction** ([heuristics](https://mspiegel.github.io/queens-without-backtracking/HEURISTICS.html)):
  - A placed queen rules out its row, its column, its region and its eight neighbours.
  - A region, row or column with one live cell takes its queen there.
  - A region confined to one line rules out the rest of that line.
  - A line confined to one region rules out the rest of that region.
  - N regions that fit inside N rows or columns rule out the other regions' cells there.
  - A cell that touches every live cell of a small region cannot hold a queen.
  - The last resort is a trial placement that runs into a contradiction.
- **How clones generate boards.** One places N queens that do not touch, gives each a one-cell region and grows the regions, backtracking when growth breaks uniqueness ([queens-puzzle](https://github.com/daniel-jones-dev/queens-puzzle), MIT). Another checks uniqueness with a backtracking solver and then requires a deduction-only solver to finish ([write-up](https://dev.to/larsniet/queens-building-a-constraint-satisfaction-puzzle-game-5547)).
- **Unverified.** A visible timer and dragging to mark X's on LinkedIn itself. Dragging was only seen on clones.

Queens does not use the chess board component. Its board is the same tile grid as Zip and Patches, with coloured regions, and its rule 4 is not how a chess queen attacks. What the two games share is the platform around the board.

## Libraries: build or buy

The project has no runtime dependency besides React and Next.js, and both existing games run their engines in plain Node for tests and command-line tools. That is the bar a library had to clear.

| Library | Version | Licence | Size, min / gzip | Does |
|---|---|---|---|---|
| chess.js | 1.4.0 | BSD-2-Clause | 35 kB / 12.0 kB | Rules |
| chessops | 0.15.1 | GPL-3.0-or-later | 58 kB / 16.9 kB | Rules, variants, FEN, SAN, PGN |
| chessground | 10.5.0 | GPL-3.0-or-later | 33 kB / 12.0 kB | Board rendering |
| react-chessboard | 5.12.4 | MIT | 73 kB / 21.6 kB | Board rendering (React, uses @dnd-kit) |
| cm-chessboard | 8.15.8 | MIT | 34 kB / 8.6 kB | Board rendering (SVG) |
| chessboard.js | 1.0.0 | MIT | 14.5 kB / 5.2 kB | Board rendering, needs jQuery |
| stockfish (nmrugg) | 19.0.1 | GPL-3.0 | lite wasm about 1.7 MB | Engine |

Versions and licences come from the npm registry and each repository's licence file. Sizes are from bundlephobia.

Decision: write both parts in the repository.

- **Rules and search.** chess.js would have covered legal moves and notation, but not search, and a generator that plays games and proves mates visits hundreds of thousands of positions per puzzle. It needs make and unmake on a flat board, which is a different shape of library. The engine here is about 950 lines and is checked against published perft counts.
- **Board.** chessground is the best board there is, and it is GPL: its README says "You must release your source code" under the GPL. This project is MIT. react-chessboard is MIT but brings its own drag-and-drop layer and its own look, and the platform's boards are DOM grids with shared tokens, pixel snapping, keyboard rules and test hooks. A board written on those is smaller than an adapter around someone else's.
- **Engine strength.** Stockfish is GPL and its smallest build is 1.7 MB, against a generator that needs three plies of lookahead.

## Piece artwork

- chess.com's piece sets are its own. Its user agreement claims all "graphics", "designs, and artwork" as its property and bars copying ([user agreement](https://www.chess.com/legal/user-agreement)). They were not used or imitated.
- The pieces here are the "Cburnett" set by Colin M.L. Burnett, the one Wikipedia and Lichess show. The author offers it under GFDL 1.2+, CC BY-SA 3.0, the 3-clause BSD licence or GPL 2+: "You may select the license of your choice" ([file page](https://commons.wikimedia.org/wiki/File:Chess_klt45.svg)). This project uses it under the BSD licence. The notice is in `docs/chess/CHESS.md`.
