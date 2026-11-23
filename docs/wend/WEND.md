# Wend

Wend is a word puzzle inspired by LinkedIn's Wend, which launched on 9 June 2026. The board is a grid of letters that hides a handful of words. Each word runs through neighbouring letters, and together the words use every letter once. The words here are in Portuguese and every board has a theme.

This document covers what the original does, the rules, the word bank, the generator and the interaction. Platform features it shares with the other games (clock, hints, reveal, results, storage, offline) are in `docs/ARCHITECTURE.md`, and seeds and daily puzzles are in `docs/SEEDS.md`.

## The original

Facts marked "live game" were read from LinkedIn's own page on 22 November 2026, played as a guest at `linkedin.com/games/wend`. The rest comes from the linked articles.

- **Launch.** Wend is LinkedIn's eighth game and its first word game since LinkedIn Games started ([LinkedIn News](https://news.linkedin.com/2026/LinkedIn-AnnouncesWend), [PocketGamer.biz](https://www.pocketgamer.biz/linkedin-launches-wend-as-first-new-word-game-in-two-years/)). The live game showed puzzle #167 on 22 November 2026, which puts #1 on 9 June 2026. New puzzles come out at midnight Pacific Time ([LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a6863543)).
- **Rules.** LinkedIn's announcement: "Connect adjacent letters to form hidden words" and "Every letter in the grid is used exactly once". The live game's instructions for #167: "Find 6 hidden words, of 5, 6, 7, 8, 9 and 10 letters. Use each letter space only once." Letters connect up, down, left and right, never diagonally, and a word may turn as often as it likes ([Gamebut](https://gamebut.com/wend)).
- **Board (live game).** #167, a Sunday, was 7x7 with four wall cells and 45 letters. `#` is a wall:

  ```
  T O # D # E H
  # P W O T A #
  L P N A N V D
  E E H D N Y E
  N C I L E C S
  A L A L N D I
  I M B L A G N
  ```

  The words were HEAVY, TOPPLE, LANDING, DOWNHILL, IMBALANCE and DESCENDANT: one word per length, and all of them about falling. The puzzle of the day before had four words of 5, 7, 8 and 10 letters ([Sportsdunia](https://www.sportsdunia.com/gaming/linkedin-wend-answers-today-21-nov-2026)).
- **Trails (live game).** A drag draws a coloured trail with small arrows, and the trail stays on the board whether it spells a word or not. Its letters show in a line under the board. A trail that spells a hidden word over the right cells locks: it gets a check mark and fills its row in the word list. BLAND can be traced on the board above and it stayed a plain trail, because it is not one of the six words.
- **Editing (live game).** Dragging from the end of a trail extends it, and dragging back shortens it. A click in the middle of a trail cuts it there, and a click on its first letter removes it. A trail cannot enter a cell another trail uses.
- **Word list (live game).** Under the board there is one row of blanks per word, shortest first, so the lengths are known from the start. The theme is not shown.
- **Hint (live game).** The first hint says "First letter of a word revealed" and starts a trail on that letter. Each further hint says "Next letter revealed" and extends it, and the word locks when its last letter is revealed. With wrong trails on the board the message starts with "Error fixed" and those trails are removed first.
- **Other controls (live game).** Undo under the board, Reset and Settings in the header, a timer. Undo steps back through trail edits and does not unlock a found word.

Board #167 is used as solver test data in `tests/wend/engine.test.ts`. It is never served as a puzzle: every board here is generated.

## Rules

- The board is square. A cell holds a letter or is a wall.
- A word is a path: each letter is a side neighbour of the one before, and no cell is used twice.
- The hidden words use every letter exactly once.
- All hidden words of a board belong to one theme.
- The lengths of the hidden words are shown from the start. The words are not.

`engine/grid.ts` has the neighbour table and the path checks.

## Portuguese and accents

The board shows plain capitals. MAÇÃ is laid out as M, A, C, A, the way Brazilian word searches print it. When a word is found, the word list shows it as it is spelled, with its accents. `engine/text.ts` does the conversion, and a `WendWord` carries both forms: `text` for the board and `display` for the list.

Everything the game says is in Portuguese: status messages, the tutorial, the board's labels for screen readers. The platform around it (header, controls, result screen) stays in English, like the rest of the site. The chess coach set that precedent.

## Word bank

`engine/bank.ts` holds 54 themes and about 2,400 entries, written by hand: fruits, the kitchen, football, Brazilian states and capitals, feelings, mathematics and so on. An entry is one word of 3 to 12 letters with no hyphen and no space. Each theme has words of many lengths, because a board takes one word per length.

The spelling of every common noun was checked against the lexicon of [fserb/pt-br](https://github.com/fserb/pt-br) (MIT). That check is not part of the build: the list is not in the repository. `tests/wend/engine.test.ts` enforces the format rules, that a word appears once per theme, and that every theme has at least four different lengths between 3 and 7 letters, which is what the smallest board needs.

Changing a word changes the boards that seeds build, so an edit to a shipped theme needs a new generator version (see `docs/SEEDS.md`).

## Data model

```ts
type WendWord = { text: string; display: string; path: number[] };
type WendShape = { size: number; letters: string[]; words: WendWord[] };
type Trail = { id: number; cells: number[]; word: number | null; hinted: number };
```

`letters` has one entry per cell, row by row, with `""` for a wall. `words` is sorted by length, and the word list on screen uses that order. A `Trail` is a line the player drew. `word` is the index of the hidden word it found, or null while it is open. `hinted` counts how many of its first letters hints revealed.

## One solution

A board is accepted only if its words fit in exactly one way. `engine/solver.ts` checks that:

1. For each word it finds every path on the board that spells it. Two paths over the same set of cells count once.
2. It then places the words one after the other so that no two share a cell, starting with the word that has the fewest paths. The lengths add up to the number of letters, so a full set of disjoint paths always covers the board.
3. A branch is dropped as soon as a word that is still waiting has no free path left.
4. It stops at two solutions. The generator keeps a board only when the count is one.

The solver works on a node budget and never on a clock, so a seed builds the same board on every device. On LinkedIn's board #167 it finds the single arrangement in 75 nodes.

The guarantee is about the hidden words, not about the dictionary. A player can trace other Portuguese words on a board, as BLAND shows on the original. Those trails stay open, exactly as they do there.

This is also why a word is found by its cells and not by its letters alone. If a hidden word can be traced somewhere else on the board, that other trace cannot be part of the solution. The game leaves it open and says: "CASA está no tabuleiro, mas passa por outras casas."

## Generator

`engine/generator/v1.ts`, in order:

1. **Theme.** A daily seed walks through one shuffled deck of all themes, one card a day, and starts over at the end. A theme therefore returns only after all the others had their day. Any other seed shuffles the deck with its own randomness.
2. **Lengths.** It picks word lengths that add up to the number of letters and that the theme has words for. Distinct lengths come first, as in the original ("5, 6, 7, 8, 9 and 10 letters"). A theme with too few long words may use a length twice. Two looser passes exist for a board size picked by hand that the tier's recipe cannot fill.
3. **Words.** One random word of the theme per length.
4. **Layout.** One path through every cell of the board is built: rows walked back and forth, turned or mirrored at random, then scrambled by backbiting. Backbiting picks an end of the path and a neighbour of it, and reverses the stretch between the two. Each move keeps a path through every cell and changes one step. The path is then cut into the words, one after the other, each reading forwards or backwards. A wall is a cell the cut skips.
5. **Check.** The solver counts the solutions. A board with exactly one is returned. Otherwise the next try starts, with its own random stream.

A theme gets 16 tries per pass before the next theme takes over. In practice the first or second board is accepted. On the 8x8 expert board more than half of the puzzles repeat a length, because few themes have words of 11 and 12 letters.

### Difficulty

| Tier | Board | Words | Letters per word | Walls | Path mixing | Theme |
| --- | --- | --- | --- | --- | --- | --- |
| easy | 5x5 | 4 to 5 | 3 to 7 | 0 to 3 | 0.05 | shown |
| medium | 6x6 | 5 to 6 | 4 to 9 | 0 to 4 | 0.5 | shown |
| hard | 7x7 | 6 to 7 | 5 to 10 | 1 to 5 | 3 | hidden until the first word |
| expert | 7x7 or 8x8 | 6 to 8 | 5 to 12 | 1 to 6 | 8 | hidden until the first word |

The `hard` tier is LinkedIn's Sunday board: 7x7, six words of 5 to 10 letters, a few walls.

Path mixing is the number of backbite moves per cell. Near zero the words run along the rows and about one word in four is a straight line, so the board reads like a word search. From 2 up the paths are as winding as they get: about 0.4 corners per letter and almost no straight word.

The original never shows the theme. Here the two easier tiers show it from the start, and the two harder ones show it once the first word is found. Without a theme, a 10-letter word on a 7x7 board is hard to spot. With it, the first word tells the player what to look for.

### Benchmark

`npm run wend:benchmark -- --count 200`, on one core of a desktop machine:

| Tier | Mean | Max | Tries (mean, max) | Corners per letter | Themes used | Distinct boards |
| --- | --- | --- | --- | --- | --- | --- |
| easy | 0.1 ms | 3.9 ms | 1.17, 4 | 0.23 | 53 | 200 of 200 |
| medium | 0.1 ms | 0.3 ms | 1.08, 3 | 0.30 | 52 | 200 of 200 |
| hard | 0.1 ms | 0.3 ms | 1.17, 3 | 0.40 | 52 | 200 of 200 |
| expert | 0.1 ms | 0.4 ms | 1.66, 4 | 0.42 | 53 | 200 of 200 |

`npm run wend:validate -- --count 100 --days 365` generated 925 boards: every tier, every tier at every size from 5 to 8, and a year of daily puzzles. All of them passed the independent validator and rebuilt identically from their seed. Over that year the same theme never came back sooner than 54 days later.

## Playing

`engine/game/state.ts` holds the rules of interaction as pure functions. A gesture is `startStroke`, any number of `moveStroke`, and `endStroke`.

- **Drag.** A press on a free letter starts a trail. The trail follows the pointer: onto a free neighbour it grows, back onto its own letters it shrinks. A fast swipe along a row or column fills the cells in between.
- **Edit.** A drag from the end of a trail extends it. A drag from the middle cuts it there first. A tap in the middle cuts it, and a tap on its first letter erases it.
- **Tap.** A tap on a free letter next to the end of the trail touched last adds that letter. Words can be entered one tap at a time. The original has no such mode. It is here for players who cannot drag.
- **Keyboard.** Arrow keys move a cursor, Enter or Space taps the cell, Backspace takes the last letter off the trail.
- **Limits.** A trail cannot enter a wall, a found word or another trail, and it cannot grow longer than the longest word still hidden.
- **Found.** When a trail spells a hidden word over that word's cells, it locks, takes its colour and fills its row in the list. The last word ends the game.

An open trail is drawn in pencil grey and says nothing about being right. Only a found word gets a colour. The first letter of every trail carries a ring, so the reading direction is visible.

The word list has one row per word, stacked from the shortest to the longest. A row shows the whole word and a check mark once the word is found, and before that only letters a hint revealed. Letters the player traced never show there, or the list would tell whether a guess is on the right track.

**Undo** goes back one gesture. **Reset** erases the open trails. Neither touches a found word.

**Hint** works like the original. It erases every open trail that is not the start of a hidden word, then reveals one letter: the next letter of a word the board already has the start of, or else the first letter of the shortest word still hidden. The revealed letters show in the word list, and the last one finds the word.

**Reveal** drops the open trails and lays the words down one at a time.

The result screen counts hints, moves (gestures that changed the board) and "Erased": trails of two letters or more that were thrown away by the player, by a reset or by a hint.

## Storage

`storage/progress.ts` stores the trails and the counters. On load every trail is checked against the board: it must be a real path over letters, and no two trails may share a cell. Whether a trail is a found word is worked out again from the puzzle, so a stored flag cannot mark a board as solved. A finished board must carry a final time and an unfinished one must not.

## Loading

The word bank is about 20 kB of text. It loads with the game's own pages and not with the hub. The hub needs each game's daily schedule and puzzle id, so those live in `engine/daily.ts` and `engine/seed.ts`, which import nothing from the generator.

## Tools

```
npm run wend:generate -- --seed 12345 --difficulty hard [--size 7] [--solution] [--json]
npm run wend:generate -- --date 2026-11-23 [--solution]
npm run wend:validate -- [--count 100] [--from 2026-06-09 --days 365]
npm run wend:benchmark -- [--count 200] [--size 7]
```
