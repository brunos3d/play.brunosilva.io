# Termo

Termo is a word game modelled on [term.ooo](https://term.ooo/): guess a hidden five-letter word, and every guess shows how close it was. It is played in Portuguese or in English. This document covers what the original does, the rules, the languages, the word lists and their licences, the tiers and the interaction. Platform features it shares with the other games (clock, results, storage, offline) are in `docs/ARCHITECTURE.md`, seeds and daily puzzles are in `docs/SEEDS.md`, and the two kinds of language are in `docs/I18N.md`.

## The original

Notes taken on 22 November 2026 from the term.ooo help text and from the articles linked below.

- **What it is.** A Portuguese adaptation of Wordle by Fernando Serboncini, launched on 5 January 2022 ([Wikipedia](https://en.wikipedia.org/wiki/Termo_(video_game)), [Olhar Digital](https://olhardigital.com.br/2022/02/23/games-e-consoles/o-jogo-alcancar-tanta-gente-me-surpreendeu-diz-criador-do-termo/)). One word per day, the same for everyone.
- **Rules.** The help text reads "Descubra a palavra certa em 6 tentativas. Depois de cada tentativa, as peças mostram o quão perto você está da solução." A letter is marked as in the word and in the right place, in the word but in another position, or not in the word. Green, yellow and grey in the default theme.
- **Accents.** "Os acentos são preenchidos automaticamente, e não são considerados nas dicas." The player types plain letters, and the game writes the word with its accents.
- **Repeated letters.** "As palavras podem possuir letras repetidas."
- **Dueto and Quarteto.** Two variants launched on 23 February 2022: two words at once, and four words at once. Every guess is played on all boards. Dueto gives seven guesses and Quarteto nine. The pages fetched for this research do not state those two numbers. They are the counts the variants are known for, and they were not checked again here.
- **Word list.** The author built it from several dictionaries and corpora and removed brand names, obscure regional words, profanity, proper nouns and verb conjugations from the answers (Wikipedia, Olhar Digital). He published the underlying data as [fserb/pt-br](https://github.com/fserb/pt-br) under the MIT licence, saying in the Olhar Digital interview: "Ela está disponível agora pra qualquer um usar em outros jogos."

Nothing from term.ooo itself is copied: not its answer list, not its daily order, not its tutorial words. Nothing from Wordle or from the New York Times lists is copied either. The lists here are built from public data sets, with our own filters.

## Rules

`engine/rules.ts` and `engine/game/state.ts` hold all of them.

1. Every hidden word has five letters. A guess must be a known five-letter word of the puzzle's language.
2. After a guess, each letter gets one mark: `right` (in the word, in this position), `place` (in the word, in another position) or `wrong` (not in the word).
3. Repeated letters follow the usual rule. Letters in the right place are matched first, and a letter is only marked `place` while the answer still has an unmatched copy. Against CARTA, the guess ARARA marks the last A `right`, the first A and the first R `place`, and the other two letters `wrong`.
4. Accents and the cedilla are never typed and never compared. MAÇÃS is typed as MACAS. A played row shows the word as it is written. English words have no accents.
5. A guess is final. There is no undo and no reset, so the frame hides both controls.
6. With more than one hidden word, one guess is played on every board that is still open. A board stops taking guesses once its word is found.
7. The game is won when every word is found, and lost when the guesses run out first.

`checkGuess(letters, language)` refuses a row before it is played. It returns a code and no sentence: `{ code: "incomplete", values: { length: 5 } }` for a row with a gap, `{ code: "unknown" }` for a word that is not in the list of that language.

## Languages

Two languages meet in Termo, and they are independent (see `docs/I18N.md`).

- **The game language** decides the words. It is the player's setting, read with `useGameLanguage()`. Portuguese and English each have their own answer list, their own accepted guesses, their own daily word and their own saved boards.
- **The interface locale** decides every sentence around the words: status lines, labels, the tutorial, the practice screen. It comes from the URL, `/en/termo` or `/pt-br/termo`.

A player can read the interface in English and guess Portuguese words, or the reverse.

### Which language a puzzle is in

| Page | Language of the words |
| --- | --- |
| The daily, `/termo` | The game language. Changing it in the settings swaps to that language's puzzle of the same day |
| A seeded puzzle, `/termo/play?seed=…` | The language of the seed, whatever the setting says. A shared link opens the same words for everyone |
| "New" on a practice puzzle | The language of the puzzle on screen |
| The practice screen | The game language, shown as a picker (`GameLanguagePicker`). A pasted canonical seed keeps its own language |

When the player picks another game language in the settings while a seeded puzzle is open, the page moves on, because a seed never changes language. A practice puzzle is replaced by a new random puzzle of the same mode in the new language. The day's Dueto or Quarteto is replaced by the same day's puzzle in the new language. A puzzle that is already in the language just picked stays. `components/game/seed-game.tsx` does this with `useGameLanguageChange`.

### Seeds

The language is part of the seed. Portuguese is the language the game shipped in, so it is left out, and every seed made before the game had two languages still builds the same words.

```
TERMO:lucky:1:hard               Portuguese
TERMO:lucky:1:hard:en            English
TERMO:2026-11-29:1:medium:en     the English daily of 29 November 2026
TERMO:2026-11-29-dueto:1:hard:en the English Dueto of that day
```

`termoLanguage(spec)` returns the language of a spec. The puzzle id is a hash of the canonical seed, so an English puzzle and a Portuguese one never share a saved board, a best time or a daily result.

### Loading the word lists

Each language's lists are a module of their own, `engine/words/pt-br/` and `engine/words/en/`, fetched with a dynamic `import()` the first time a puzzle of that language is opened. A Portuguese player never downloads the English lists, and the reverse.

```ts
await loadTermoWords("en");          // fetches the chunk once, then resolves at once
answerWords("en");                   // synchronous, like every accessor below
isKnownWord("house", "en");
displayWord("aviao", "pt-br");       // "avião"
easyPoolSize("en");
```

The accessors take the language and throw a clear error when that language was not loaded first. `loadTermoPuzzle(spec)` loads the language of a spec and then builds its puzzle. The game container passes it to `useGeneratedPuzzle`, so the loading board is on screen while the list arrives.

`engine/seed.ts` and `engine/daily.ts` do not import `engine/words.ts`. The hub reads the daily schedule and the puzzle id from them and loads no word list. The practice screen loads none either. `e2e/termo/languages.spec.ts` checks all of this in the browser's network log.

Command-line tools and the browser tests' own Node code need the words without waiting. They import `scripts/termo/all-words.ts`, which registers both languages at once. The app never imports that file.

**Offline.** A list is a script like any other, so the offline worker keeps it once it has been fetched through the worker. A language that was played online once keeps working offline. A language that was never played is not on the device: opening it without a connection shows "The word list could not be loaded" with a button to try again, and not the bad seed screen. The worker does not fetch the lists ahead of time, because they are not named in the HTML of any page.

### Interface text

Every sentence is in `messages/en/termo.json` and `messages/pt-br/termo.json`. The engine returns data, and `engine/text.ts` turns it into a sentence with a translator, as in the other games:

```ts
guessErrorText(t, { code: "unknown" });      // "That word is not in the list."
endText(t, puzzle, state);                   // "Out of guesses. The word was AVIÃO."
hintText(t, puzzle, { board: 1, index: 3 }); // "In word 2, the 4th letter is I."
idleText(t, puzzle, state);                  // "Guess 2 of 6."
modeSummaryText(t, "hard");                  // "2 words at once, 7 guesses"
```

The words inside a sentence stay in the game language: a Portuguese interface over an English puzzle says "A palavra era HOUSE".

Two parts of the tutorial follow the game language and not the interface, because they are about the words. The three example words are words of the language being played (`TERMO_EXAMPLES` in `engine/config.ts`: FESTA, CAMPO, NUVEM and PLANT, HOUSE, MONEY), while the sentence under each one is interface text with the letter as a placeholder. The note about accents is only shown when the words are Portuguese.

The mode names Termo, Dueto and Quarteto are proper names and are the same in both locales.

## Modes

The player picks a mode, by the names term.ooo uses, and not a difficulty.

| Mode | Hidden words | Guesses | Tier in the seed | Answers come from |
| --- | --- | --- | --- | --- |
| Termo | 1 | 6 | medium | all answers of the language: 1514 in Portuguese, 1989 in English |
| Dueto | 2 | 7 | hard | all answers |
| Quarteto | 4 | 9 | expert | all answers |

Seeds keep the platform's four tiers, so each mode sits on one of them (`TERMO_MODES` in `engine/config.ts`). The fourth tier, easy, is also Termo: one word in six guesses, drawn from the 700 most common answers of the language. Neither the practice screen nor the daily uses it. It stays valid in seeds.

The practice screen is Termo's own (`components/game/practice-setup.tsx`): it shows the language picker and the three modes where the shared screen shows four difficulties. `TERMO_MODE_NAMES` maps every tier to its mode name for the other places that print a tier.

## The daily and the day's Dueto and Quarteto

The daily puzzle is always one board, on every day of the week. `TERMO_DAILY_CONFIG` in `engine/daily.ts` overrides the shared weekly schedule with the medium tier for all seven days, so the daily seed is always `TERMO:<date>:1:medium`, with `:en` at the end for English.

There is one daily per language: the same date and the same number, with different words. `getTermoDailyInfo(date, language)` returns it. Its result is stored per language (`termo:2026-11-29` and `termo@en:2026-11-29`), so finishing the day in Portuguese leaves the English puzzle open. The streak counts dates, so a date solved in both languages counts once.

Two boards and four boards are offered after it. When a puzzle of the day is over, a short list appears on the result screen and again under the board, where the keyboard was (`components/game/next-modes.tsx`): "Play the daily Dueto", "Play the daily Quarteto" and "Practice". From the day's Dueto the list leads to the daily Termo and to the Quarteto, and so on. On the result screen the list takes the place of the suggested games, through the frame's `resultActions`. The Dueto and the Quarteto it offers are the ones of the language just played.

The day's Dueto and Quarteto are the same for everyone who plays in that language, but they are not the daily:

- Their seeds are `TERMO:<date>-dueto:1:hard` and `TERMO:<date>-quarteto:1:expert`, with `:en` at the end for English, played through `/termo/play`. `termoDailyVariantSpec(date, variant, language)` builds them and `termoDailyVariantFromSpec` recognizes them.
- They have no puzzle number, they do not count for the streak, and the hub card only tracks the one-board daily. Progress and best times are saved like for any seeded puzzle.
- They have no "New game" button. Each is one puzzle per day and per language.
- The token is the date plus the mode, so the seed is not mistaken for the daily one. The generator still reads the date out of it: the three puzzles of a date in one language are dealt from decks and never share a word (see Generator).

## Word lists

Each language has two generated modules of five-letter words: the answers, from the most common word down, and the other accepted guesses. Portuguese has a third one for accented spellings. Each list is one long string, cut up on first use, so the browser parses a few strings and no array of ten thousand items.

| Module | Content | Size | Gzipped |
| --- | --- | --- | --- |
| `words/pt-br/answers.ts` | 1514 answers, most common first | 9.1 kB | 5.1 kB |
| `words/pt-br/guesses.ts` | 8961 more accepted guesses, sorted | 46.2 kB | 21.6 kB |
| `words/pt-br/accents.ts` | 2016 accented spellings | 13.5 kB | 7.2 kB |
| `words/en/answers.ts` | 1989 answers, most common first | 15.2 kB | 8.0 kB |
| `words/en/guesses.ts` | 6890 more accepted guesses, sorted | 39.6 kB | 19.3 kB |

The sizes include the licence comment, which a production build drops. Without it, a player downloads about 31 kB gzipped for Portuguese or 22 kB for English.

`words/<language>/index.ts` is written by hand. It gathers the generated modules of a language into one object, so they travel as one chunk.

The order of the answers is part of generator version 1 in both languages. Rebuilding a list with different filters or newer data changes the word a seed produces, so it needs a new generator version (see `engine/seed.ts`).

### Portuguese

#### Source and licence

The data is [fserb/pt-br](https://github.com/fserb/pt-br), built from commit `93ba2a6f3b2f85262fba72df09d448c6bb2fa50a` (8 August 2025). It is used under the MIT License, Copyright 2021 Fernando Serboncini. The full copyright and permission notice is at the top of each generated file in `src/games/termo/engine/words/pt-br/`.

Files used:

| File | Content | Used for |
| --- | --- | --- |
| `lexico` | 145,744 dictionary entries | answers, guesses, accents |
| `conjugações` | 195,751 verb forms | guesses |
| `icf` | 419,486 words with an inverse corpus frequency. Lower means more common: "de" is 3.02 | ranking, choosing between spellings |
| `listas/negativas` | 340 words the author keeps out of answers | answer filter |
| `listas/verbos` | 4,023 infinitives | telling an infinitive from a conjugated form |

#### Build

```
npm run termo:words -- --data <directory with the fserb/pt-br files>
```

`scripts/termo/build-words.ts` writes the three modules.

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

### English

#### Sources and licences

Three sources, picked on 25 November 2026. Each one has a licence that allows use in a public repository, and the notices they ask for are at the top of each generated file in `src/games/termo/engine/words/en/`.

| Source | Version | Licence | Used for |
| --- | --- | --- | --- |
| [SCOWL](http://wordlist.aspell.net), Spell Checker Oriented Word Lists, by Kevin Atkinson | 2020.12.07, sizes 10 to 70 | Its own permissive notice (use, copy, modify, distribute and sell, with the copyright notice kept). The sizes used draw on public domain lists (Moby Words II, Brian Kelk's frequency list, 12Dicts) and on WordNet and VarCon, whose notices are kept too | which words are familiar, which spellings are shared by every dialect, and part of the guesses |
| ENABLE, the `enable1` word list by Alan Beale and M. Cooper | the 172,820 word list, fetched from [norvig.com/ngrams/enable1.txt](https://norvig.com/ngrams/enable1.txt) | Public domain | guesses |
| Word counts of the Google Books Ngram Corpus, version 3 (20200217), as compiled in [hackerb9/gwordlist](https://github.com/hackerb9/gwordlist) | commit `5e9902468ab09802474884c3df00d77463e5cb24`, file `frequency-alpha-alldicts.txt` | Creative Commons Attribution 3.0 Unported, for the corpus (Google) and for the compiled list | which words are answers, and their order |

What was looked at and left out:

- SCOWL size 80 and above. Size 80 adds the UK Advanced Cryptics Dictionary, whose licence asks for its whole text to be shipped with any product that uses it. ENABLE covers most of the same ground and is public domain.
- The Wordle answer and guess lists, in the original or in the New York Times version. They are not licensed for reuse.
- Frequency lists built from subtitles or from Wikipedia (hermitdave/FrequencyWords, wordfreq). Their data is under share-alike licences.
- Peter Norvig's `count_1w.txt` and the lists derived from it. The counts come from a corpus distributed by the Linguistic Data Consortium, and their licence for reuse is not stated.

The Google Books counts come from books, so bookish words rank a little higher than they would in speech ("shall", "hence"), and words of everyday talk a little lower ("pizza", "hello"). The ranking only decides which answers are among the first 700, and it reads well for that.

#### Build

```
mkdir data && cd data
curl -L -o scowl.tar.gz https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz
tar -xzf scowl.tar.gz
curl -L -O https://norvig.com/ngrams/enable1.txt
curl -L -O https://raw.githubusercontent.com/hackerb9/gwordlist/5e9902468ab09802474884c3df00d77463e5cb24/frequency-alpha-alldicts.txt
cd .. && npm run termo:words:en -- --data data
```

`scripts/termo/build-words-en.ts` writes the two modules. The downloaded files are not committed.

**Accepted guesses (8879).** Every five-letter word, a to z, of:

- ENABLE (8636),
- the SCOWL word lists up to size 70, in every spelling: American, British, Canadian, Australian and their variants (6727, most of them also in ENABLE). COLOR, FIBRE, FIBER and TYRES are all accepted.

Names, abbreviations and contractions are in files of their own in SCOWL and are not read. `scripts/termo/guesses-exclude-en.txt` refuses 16 slurs that have no other meaning. Rude words in general stay valid guesses.

**Answers (1989).** An answer is a word that:

- is in SCOWL sizes 10 to 35. Size 35 is the one its README recommends for a small dictionary, and holds the most familiar words,
- is spelled the same in every dialect (`english-words.*`). COLOR and COLOUR are both left out, so nobody has to guess which one the game means,
- appears at least 250,000 times in the Google Books corpus,
- is not a regular inflection: a plural or a verb form in S ("years", "boxes", "flies"), a past form in ED ("asked", "moved", "tried") or a form in ING ("going", "using"). The rule looks for the base word among SCOWL sizes up to 50. Irregular forms are words of their own and stay: "wrote", "taken", "teeth",
- is not in SCOWL's own lists of slurs and swear words (`misc/offensive.*` and `misc/profane.*` in the release),
- is not in `scripts/termo/answers-exclude-en.txt`.

SCOWL's taboo lists are short, so the exclusion list does most of that work. It was written by reading every candidate. It drops 123 words: offensive, sexual or unpleasant ones, names that also exist as a common word ("china", "peter"), prefixes and spoken contractions ("multi", "gonna"), irregular plurals ("radii", "fungi"), comparatives of another answer ("older", "wiser"), nouns made from a verb that nobody would think of ("taker", "payer"), and jargon or variant spellings ("dimer", "karat").

`scripts/termo/answers-include-en.txt` adds 169 words back: four that the inflection rule takes for a form of another word ("thing", "being", "tweed", "icing"), two that SCOWL files under one dialect although every dialect spells them the same ("among", "leapt"), and 163 familiar words from SCOWL sizes 40 to 70, each picked by hand ("pixel", "sushi", "karma", "emoji").

The answers are sorted by their count in the corpus, the most common first: "which", "their", "there", "other", "would". The easy tier draws from the first 700.

To review the lists after a change:

```
npx tsx scripts/termo/build-words-en.ts --data <dir> --report            # answers, in rank order
npx tsx scripts/termo/build-words-en.ts --data <dir> --report --counts   # the same, with the corpus count of each
npx tsx scripts/termo/build-words-en.ts --data <dir> --dropped           # common words the inflection rule removed, and the base it found
npx tsx scripts/termo/build-words-en.ts --data <dir> --rare 50           # words that are not answers, up to a SCOWL size, by count
```

## Generator

`engine/generator/index.ts`. The tier gives the number of words and the pool, and the language of the spec gives the answer list.

A practice seed draws positions in the answer list with a PRNG keyed by `termoSeeds.rngKey(spec)`, until it has enough distinct ones. The key holds the language, except for Portuguese.

A seed about a date deals from shuffled decks of the answer list instead, so words do not come back soon. Each language has its own decks:

- The daily Termo takes one card a day from the main deck. The deck has 1514 cards in Portuguese and 1989 in English, so the daily word does not repeat for over four years.
- The day's Dueto and Quarteto take the cards of their date from a second deck, seven in a row: the first two for the Dueto and the next four for the Quarteto. A card that equals the day's Termo is skipped, which is what the seventh card is for. That deck lasts 216 days in Portuguese and 284 in English.
- The easy tier is not part of the daily. A date seed that asks for it gets the first common word at or after the date's place in the main deck.

Each deck is shuffled once per generator version and language with a fixed key (`TERMO|deck|v1` and `TERMO|variants|v1`, with `|en` at the end for English), and the date only says where to cut it, so this is still a pure function of the seed. The Portuguese keys are the ones the game had before it had two languages, so every Portuguese seed builds the words it always built. `npm run termo:validate -- --days 365` confirms, for each language, that 365 daily puzzles hide 365 different words and that the three puzzles of a date never share one.

Generation takes well under a millisecond once the list is loaded.

```ts
type TermoPuzzle = {
  id: string; seed: string; version: number; difficulty: Difficulty;
  language: "pt-br" | "en"; // the language of the words, and of the accepted guesses
  answers: string[];        // plain five-letter words, one per board
  maxGuesses: number;
  metadata: { generatorVersion: number; shareSeed: string; poolSize: number; ranks: number[] };
};
```

`validateTermoPuzzle` checks a puzzle on its own: every word is in the answer list of the puzzle's language and can be typed as a guess, no word repeats, and the counts match the tier.

Seeds look like `TERMO:2026-11-23:1:medium`. The codec's board size is the word length, fixed at 5, so the practice screen has no size picker. Daily puzzle #1 is 22 November 2026, the day Termo joined the hub.

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
- **On-screen keyboard.** QWERTY in both languages, with a backspace key after L, a key that clears the row before Z (CLEAR, or LIMPAR in Portuguese) and ENTER after M. A press does not take the focus, so the physical keyboard keeps working after a tap.
- **Key colours.** Each key shows the best mark known for its letter. With two boards the key is split in halves, with four in quarters, laid out like the boards. The part of a solved board goes grey.
- **Frame shortcuts.** The frame listens for Z (undo) and H (hint). Termo handles keys in the capture phase and marks them as handled, so both are plain letters here.
- **Enter and focus.** Enter plays the row whenever something is typed, even if a click left the focus on the Hint button. With an empty row, Enter on a focused button activates that button.
- **Marks are not colour alone.** A letter in the right place is a filled green tile, a letter in another position has a dashed ring on amber, and a letter outside the word is flat grey. Each tile also has a text label for screen readers, in the interface locale ("A, in another position").
- **Hint.** Gives one letter of the answer in its place: the first position the player does not know yet, on the first open board. The letter is pencilled in green in the row being typed and in every later row. If another letter is typed over it, it moves to the corner of the tile.
- **Reveal.** Shows the words and ends the game without a result that counts.
- **Share.** The shared text carries the grid of coloured squares, built by `engine/share.ts`: one block per board, two boards side by side. It has no letters, so it is the same in every language.

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

`storage/progress.ts` saves the language, the guesses, the row being typed, the cursor, the hints and the clock through `saveBoard("termo", …)`. Loading treats the data as untrusted: the board must be in the puzzle's language, every guess must be a word that language accepts, no guess may follow the one that ended the game, hints must point at real positions, and the status is worked out again from the guesses. A finished game must have a final time and an open one must not. Anything else starts a fresh game.

A board saved before the game had two languages has no language field. It is read as Portuguese, and its seed and puzzle id are unchanged, so it opens as it was. The snapshot version is still 1.

## Differences from term.ooo

- The word lists are our own selection from public data, so the answers and what counts as a valid guess differ in places.
- The daily words are dealt from a shuffled deck of our own answer list. Which word falls on which day has nothing to do with the original.
- There is an English game next to the Portuguese one, with its own lists and its own daily.
- Termo, Dueto and Quarteto are modes of one game here. The daily is always Termo, the day's Dueto and Quarteto are offered once a puzzle of the day is over, and the practice screen offers all three.
- Hint and Reveal exist here and not in the original. There is a clock, and no statistics histogram.
- A key to clear the whole row was added.

## Files

```
src/games/termo/
  engine/          types, words (loading and list access), words/pt-br/ and words/en/ (generated, plus an index each),
                   rules, text (sentences), config, seed, daily, generator/, share, game/state
  storage/         progress.ts
  hooks/           use-termo-game.ts
  components/      board/, keyboard/, game/, tutorial/, termo.css
messages/          en/termo.json, pt-br/termo.json
src/app/[locale]/termo/   layout, page (daily), play, practice
scripts/termo/     build-words.ts, answers-exclude.txt, answers-include.txt (Portuguese)
                   build-words-en.ts, answers-exclude-en.txt, answers-include-en.txt, guesses-exclude-en.txt (English)
                   all-words.ts, generate, validate, benchmark
tests/termo/       engine.test.ts, game.test.ts, text.test.ts, words-loading.test.ts
e2e/termo/         helpers.ts, gameplay.spec.ts, languages.spec.ts
```

## Commands

```
npm run termo:generate -- --seed 12345 --difficulty hard --solution [--lang en]
npm run termo:validate -- --count 200 --days 365 [--lang en]
npm run termo:benchmark -- --count 2000 [--lang en]
npm run termo:words -- --data <directory with the fserb/pt-br files>
npm run termo:words:en -- --data <directory with SCOWL, ENABLE and the word counts>
```

`validate` and `benchmark` run both languages unless `--lang` names one.
