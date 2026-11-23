# Termo

Termo is a word game in Portuguese, modelled on [term.ooo](https://term.ooo/): guess a hidden five-letter word, and every guess shows how close it was. This document covers what the original does, the rules, the word lists and their licence, the tiers and the interaction. Platform features it shares with the other games (clock, results, storage, offline) are in `docs/ARCHITECTURE.md`, and seeds and daily puzzles are in `docs/SEEDS.md`.

The game's own text (messages, tutorial, keyboard labels) is in Brazilian Portuguese, because the words are. The frame around it (Hint, Reveal, the result screen) stays in English like the rest of the platform.

## The original

Notes taken on 22 November 2026 from the term.ooo help text and from the articles linked below.

- **What it is.** A Portuguese adaptation of Wordle by Fernando Serboncini, launched on 5 January 2022 ([Wikipedia](https://en.wikipedia.org/wiki/Termo_(video_game)), [Olhar Digital](https://olhardigital.com.br/2022/02/23/games-e-consoles/o-jogo-alcancar-tanta-gente-me-surpreendeu-diz-criador-do-termo/)). One word per day, the same for everyone.
- **Rules.** The help text reads "Descubra a palavra certa em 6 tentativas. Depois de cada tentativa, as peças mostram o quão perto você está da solução." A letter is marked as in the word and in the right place, in the word but in another position, or not in the word. Green, yellow and grey in the default theme.
- **Accents.** "Os acentos são preenchidos automaticamente, e não são considerados nas dicas." The player types plain letters, and the game writes the word with its accents.
- **Repeated letters.** "As palavras podem possuir letras repetidas."
- **Dueto and Quarteto.** Two variants launched on 23 February 2022: two words at once, and four words at once. Every guess is played on all boards. Dueto gives seven guesses and Quarteto nine. The pages fetched for this research do not state those two numbers. They are the counts the variants are known for, and they were not checked again here.
- **Word list.** The author built it from several dictionaries and corpora and removed brand names, obscure regional words, profanity, proper nouns and verb conjugations from the answers (Wikipedia, Olhar Digital). He published the underlying data as [fserb/pt-br](https://github.com/fserb/pt-br) under the MIT licence, saying in the Olhar Digital interview: "Ela está disponível agora pra qualquer um usar em outros jogos."

Nothing from term.ooo itself is copied: not its answer list, not its daily order, not its tutorial words. The lists here are built from the public data set, with our own filters.

## Rules

`engine/rules.ts` and `engine/game/state.ts` hold all of them.

1. Every hidden word has five letters. A guess must be a known five-letter word.
2. After a guess, each letter gets one mark: `right` (in the word, in this position), `place` (in the word, in another position) or `wrong` (not in the word).
3. Repeated letters follow the usual rule. Letters in the right place are matched first, and a letter is only marked `place` while the answer still has an unmatched copy. Against CARTA, the guess ARARA marks the last A `right`, the first A and the first R `place`, and the other two letters `wrong`.
4. Accents and the cedilla are never typed and never compared. MAÇÃS is typed as MACAS. A played row shows the word as it is written.
5. A guess is final. There is no undo and no reset, so the frame hides both controls.
6. With more than one hidden word, one guess is played on every board that is still open. A board stops taking guesses once its word is found.
7. The game is won when every word is found, and lost when the guesses run out first.

`checkGuess` refuses a row before it is played and returns the sentence for the status line: "A palavra precisa ter 5 letras." for an incomplete row, "Essa palavra não está na lista." for an unknown word.

## Modes

The player picks a mode, by the names term.ooo uses, and not a difficulty.

| Mode | Hidden words | Guesses | Tier in the seed | Answers come from |
| --- | --- | --- | --- | --- |
| Termo | 1 | 6 | medium | all 1514 answers |
| Dueto | 2 | 7 | hard | all answers |
| Quarteto | 4 | 9 | expert | all answers |

Seeds keep the platform's four tiers, so each mode sits on one of them (`TERMO_MODES` in `engine/config.ts`). The fourth tier, easy, is also Termo: one word in six guesses, drawn from the 700 most common answers. Neither the practice screen nor the daily uses it. It stays valid in seeds.

The practice screen is Termo's own (`components/game/practice-setup.tsx`): it shows the three modes where the shared screen shows four difficulties. `TERMO_MODE_NAMES` maps every tier to its mode name for the other places that print a tier.

## The daily and the day's Dueto and Quarteto

The daily puzzle is always one board, on every day of the week. `TERMO_DAILY_CONFIG` in `engine/daily.ts` overrides the shared weekly schedule with the medium tier for all seven days, so the daily seed is always `TERMO:<date>:1:medium`.

Two boards and four boards are offered after it. When a puzzle of the day is over, a short list appears on the result screen and again under the board, where the keyboard was (`components/game/next-modes.tsx`): "Play the daily Dueto", "Play the daily Quarteto" and "Practice". From the day's Dueto the list leads to the daily Termo and to the Quarteto, and so on. On the result screen the list takes the place of the suggested games, through the frame's `resultActions`.

The day's Dueto and Quarteto are the same for everyone, but they are not the daily:

- Their seeds are `TERMO:<date>-dueto:1:hard` and `TERMO:<date>-quarteto:1:expert`, played through `/termo/play`. `termoDailyVariantSpec` builds them and `termoDailyVariantFromSpec` recognizes them.
- They have no puzzle number, they do not count for the streak, and the hub card only tracks the one-board daily. Progress and best times are saved like for any seeded puzzle.
- They have no "New game" button. Each is one puzzle per day.
- The token is the date plus the mode, so the seed is not mistaken for the daily one. The generator still reads the date out of it: the three puzzles of a date are dealt from decks and never share a word (see Generator).

## Word lists

### Source and licence

The data is [fserb/pt-br](https://github.com/fserb/pt-br), built from commit `93ba2a6f3b2f85262fba72df09d448c6bb2fa50a` (8 August 2025). It is used under the MIT License, Copyright 2021 Fernando Serboncini. The full copyright and permission notice is at the top of each generated file in `src/games/termo/engine/words/`.

Files used:

| File | Content | Used for |
| --- | --- | --- |
| `lexico` | 145,744 dictionary entries | answers, guesses, accents |
| `conjugações` | 195,751 verb forms | guesses |
| `icf` | 419,486 words with an inverse corpus frequency. Lower means more common: "de" is 3.02 | ranking, choosing between spellings |
| `listas/negativas` | 340 words the author keeps out of answers | answer filter |
| `listas/verbos` | 4,023 infinitives | telling an infinitive from a conjugated form |

### Build

```
npm run termo:words -- --data <directory with the fserb/pt-br files>
```

`scripts/termo/build-words.ts` writes three modules. Each list is one long string, cut up on first use, so the browser parses three strings and no array of ten thousand items.

| Module | Content | Size | Gzipped |
| --- | --- | --- | --- |
| `words/answers.ts` | 1514 answers, most common first | 9.1 kB | 5.2 kB |
| `words/guesses.ts` | 8961 more accepted guesses, sorted | 46.2 kB | 21.5 kB |
| `words/accents.ts` | 2016 accented spellings | 15.6 kB | 7.1 kB |

The sizes include the licence comment, which a production build drops.

**Accepted guesses (10,475).** Every five-letter form, once accents are stripped, of:

- the dictionary entries (6301),
- the verb forms (3543),
- regular plurals and feminines of dictionary entries (1946). The dictionary lists lemmas, so "gatos", "belas", "meses" and "leões" come from rules: add S after a vowel, ES after R, Z or S, ÕES for ÃO, plus the forms the frequency list confirms (feminine in A, plurals in IS and NS).

The rules also produce a few forms nobody says, such as a plural of an adverb. A guess list that is too wide costs nothing. One that rejects a real word is annoying.

**Accents.** When several spellings share one plain form, the most frequent one is shown. "porem" shows as "porém", not as the verb form "porem".

**Answers (1514).** An answer is a dictionary entry that:

- is the spelling shown for its letters. "sabiá" is not an answer, because typing SABIA shows "sabia",
- is not in `negativas`,
- has no K, W or Y, which mark loanwords,
- is not a conjugated verb form with an ending only verbs have ("falou", "comem"),
- is not a regular plural or feminine of another entry ("todos", "horas"),
- has an ICF of at most 13.472, and is not in `scripts/termo/answers-exclude.txt`.

That exclusion list was written by reading every candidate. It drops 360 words in six groups: contractions ("neste"), feminine doubles of an answer ("linda" next to "lindo"), verb forms that the endings rule cannot catch ("tinha", "chega"), names of people, places and brands ("jesus", "china", "fusca"), foreign words and spellings from Portugal ("mouse", "facto"), and prefixes or jargon ("micro", "cível").

Past ICF 13.472 most dictionary entries are obscure, so from there on a word is an answer only if `scripts/termo/answers-include.txt` lists it. That file names 374 words: less frequent everyday words ("sagaz", "gambá", "trenó"), and 16 common words that the automatic filters take for a verb form or a plural ("verão", "tosse", "pires").

To review the lists after a change:

```
npx tsx scripts/termo/build-words.ts --data <dir> --report            # answers, in rank order
npx tsx scripts/termo/build-words.ts --data <dir> --dropped           # entries the automatic filters removed
```

The order of `ANSWERS` is part of generator version 1. Rebuilding the lists with different filters or newer data changes the word a seed produces, so it needs a new generator version (see `engine/seed.ts`).

## Generator

`engine/generator/index.ts`. The tier gives the number of words and the pool.

A practice seed draws positions in the answer list with a PRNG keyed by `termoSeeds.rngKey(spec)`, until it has enough distinct ones.

A seed about a date deals from shuffled decks of the answer list instead, so words do not come back soon:

- The daily Termo takes one card a day from the main deck. The deck has 1514 cards, so the daily word does not repeat for over four years.
- The day's Dueto and Quarteto take the cards of their date from a second deck, seven in a row: the first two for the Dueto and the next four for the Quarteto. A card that equals the day's Termo is skipped, which is what the seventh card is for. That deck lasts 216 days.
- The easy tier is not part of the daily. A date seed that asks for it gets the first common word at or after the date's place in the main deck.

Each deck is shuffled once per generator version with a fixed key, and the date only says where to cut it, so this is still a pure function of the seed. `npm run termo:validate -- --days 365` confirms that 365 daily puzzles hide 365 different words and that the three puzzles of a date never share one.

Generation takes well under a millisecond.

```ts
type TermoPuzzle = {
  id: string; seed: string; version: number; difficulty: Difficulty;
  answers: string[];     // plain five-letter words, one per board
  maxGuesses: number;
  metadata: { generatorVersion: number; shareSeed: string; poolSize: number; ranks: number[] };
};
```

`validateTermoPuzzle` checks a puzzle on its own: every word is in the answer list and can be typed as a guess, no word repeats, and the counts match the tier.

Seeds look like `TERMO:2026-11-23:1:medium`. The codec's board size is the word length, fixed at 5, so the practice screen has no size picker. Daily puzzle #1 is 22 November 2026, the day Termo joined the hub.

`engine/seed.ts` and `engine/daily.ts` do not import the word lists. The hub reads the daily schedule and the puzzle id from them, and the 70 kB of words load only with the Termo routes.

## Game state

```ts
type TermoState = {
  puzzleId: string;
  guesses: string[];    // played words, plain
  draft: string[];      // the row being typed, one entry per position
  cursor: number;       // 0 to 5. Five means the row is full
  hints: { board: number; index: number }[];
  status: "playing" | "solved" | "lost";
  revealed: boolean;
};
```

Marks are never stored. `boardRows` works them out from the answers and the guesses, and a solved board keeps only the rows up to the guess that found it.

Numbers on the result screen: moves are the guesses played, misses are the guesses that did not find a word (guesses minus words found), hints are the letters given away.

A lost game is reported to the platform as `revealed: true, failed: true`. It closes the day like a revealed puzzle, with no streak and no best time, and the result screen says "Out of guesses".

## Interaction

- **Typing.** Letters go to the cursor, which then jumps to the next empty position. Backspace clears the letter under the cursor, or the one before it. Delete clears the whole row. The left and right arrows move the cursor, and so does a tap on a position. Enter plays the row.
- **On-screen keyboard.** QWERTY, with a backspace key after L, LIMPAR (clear the row) before Z and ENTER after M. A press does not take the focus, so the physical keyboard keeps working after a tap.
- **Key colours.** Each key shows the best mark known for its letter. With two boards the key is split in halves, with four in quarters, laid out like the boards. The part of a solved board goes grey.
- **Frame shortcuts.** The frame listens for Z (undo) and H (hint). Termo handles keys in the capture phase and marks them as handled, so both are plain letters here.
- **Enter and focus.** Enter plays the row whenever something is typed, even if a click left the focus on the Hint button. With an empty row, Enter on a focused button activates that button.
- **Marks are not colour alone.** A letter in the right place is a filled green tile, a letter in another position has a dashed ring on amber, and a letter outside the word is flat grey. Each tile also has a text label for screen readers ("A, em outra posição").
- **Hint.** Gives one letter of the answer in its place: the first position the player does not know yet, on the first open board. The letter is pencilled in green in the row being typed and in every later row. If another letter is typed over it, it moves to the corner of the tile.
- **Reveal.** Shows the words and ends the game without a result that counts.
- **Share.** The shared text carries the grid of coloured squares, built by `engine/share.ts`: one block per board, two boards side by side.

  ```
  Termo
  3/6
  ⬛🟩🟨⬛🟩
  ⬛🟨⬛⬛⬛
  🟩🟩🟩🟩🟩
  00:41
  Hints: 0
  Misses: 2
  ```

- **Layout.** One tile size is computed for the whole stage from the width and from the height left after the header, the status line, the keyboard and the controls. On a 360 by 640 phone the one-word board has 34 px tiles and everything down to the controls fits without scrolling. Two boards sit side by side with 25 px tiles. Four boards form a two by two grid with 24 px tiles. Rows that are not reached yet are drawn as thin slots there, and the keyboard and the status line are pinned to the bottom of the screen, so the page only needs to scroll late in the game.

## Storage

`storage/progress.ts` saves the guesses, the row being typed, the cursor, the hints and the clock through `saveBoard("termo", …)`. Loading treats the data as untrusted: every guess must be a known word, no guess may follow the one that ended the game, hints must point at real positions, and the status is worked out again from the guesses. A finished game must have a final time and an open one must not. Anything else starts a fresh game.

## Differences from term.ooo

- The word lists are our own selection from the same public data, so the answers and what counts as a valid guess differ in places.
- The daily words are dealt from a shuffled deck of our own answer list. Which word falls on which day has nothing to do with the original.
- Termo, Dueto and Quarteto are modes of one game here. The daily is always Termo, the day's Dueto and Quarteto are offered once a puzzle of the day is over, and the practice screen offers all three.
- Hint and Reveal exist here and not in the original. There is a clock, and no statistics histogram.
- A key to clear the whole row was added.

## Files

```
src/games/termo/
  engine/          types, words (list access), words/ (generated), rules, config, seed, daily,
                   generator/, share, game/state
  storage/         progress.ts
  hooks/           use-termo-game.ts
  components/      board/, keyboard/, game/, tutorial/, termo.css
src/app/termo/     layout, page (daily), play, practice
scripts/termo/     build-words.ts, answers-exclude.txt, answers-include.txt, generate, validate, benchmark
tests/termo/       engine.test.ts, game.test.ts
e2e/termo/         helpers.ts, gameplay.spec.ts
```

## Commands

```
npm run termo:generate -- --seed 12345 --difficulty hard --solution
npm run termo:validate -- --count 200 --days 365
npm run termo:benchmark -- --count 2000
npm run termo:words -- --data <directory with the fserb/pt-br files>
```
