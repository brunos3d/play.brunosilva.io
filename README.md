# play.brunosilva.io

<p align="center">
  <a href="https://play.brunosilva.io/">
    <img alt="Minigames: small daily logic puzzles" src="./public/og/home.png" width="720" />
  </a>
</p>

A small platform of daily logic puzzles, playable at [play.brunosilva.io](https://play.brunosilva.io/). It currently has seven games. Zip, Patches, Queens, Sumbreak and Wend are inspired by the LinkedIn games of the same name, Chess by the puzzles of chess.com and Lichess, and Termo by [term.ooo](https://term.ooo/):

- **Zip**: draw one path through every cell, passing the numbers in order.
- **Patches**: cover the grid with rectangles so that each one holds exactly one clue.
- **Chess**: solve a tactic from a generated game, with a coach who explains every move.
- **Queens**: place one queen in every row, column and coloured region so that no two touch.
- **Sumbreak**: merge equal neighbours into their sum, in the right order, until one tile is left.
- **Wend**: trace the hidden words of a theme through neighbouring letters until every letter is used, in English or Portuguese.
- **Termo**: guess a hidden five-letter word from the marks each guess gets, in English or Portuguese. Dueto and Quarteto hide two and four words at once.

Every game gets one new board per day, the same for every player, plus unlimited practice. Puzzles are generated in the browser from a seed, and progress, streaks and best times stay on the device. The app installs as a PWA and plays offline after the first visit.

The site reads in English and in Brazilian Portuguese. Two features use a server: challenge rooms, where friends race through the same boards, and the ranking of the daily puzzles.

## Screenshots

<table>
  <tr>
    <th width="33%">Hub</th>
    <th width="33%">Zip</th>
    <th width="33%">Patches</th>
  </tr>
  <tr>
    <td><img alt="Hub with the first two of the seven games, today's status and the streak" src="./.github/screenshots/hub.png" /></td>
    <td><img alt="Zip board with blocked cells, a hidden number and the path drawn through the first four numbers" src="./.github/screenshots/zip.png" /></td>
    <td><img alt="Patches board with most of its patches placed" src="./.github/screenshots/patches.png" /></td>
  </tr>
</table>

<table>
  <tr>
    <th width="33%">Chess</th>
    <th width="33%">Queens</th>
    <th width="33%">Chess, dark theme</th>
  </tr>
  <tr>
    <td><img alt="Chess board one move into a fork, with the coach asking for the next move" src="./.github/screenshots/chess.png" /></td>
    <td><img alt="Queens board with five of eight queens placed and the cells they rule out dotted" src="./.github/screenshots/queens.png" /></td>
    <td><img alt="Chess in the dark theme" src="./.github/screenshots/chess-dark.png" /></td>
  </tr>
</table>

<table>
  <tr>
    <th width="33%">Sumbreak</th>
    <th width="33%">Sumbreak, dark theme</th>
    <th width="33%"></th>
  </tr>
  <tr>
    <td><img alt="Sumbreak board five merges in, with eleven numbered tiles left" src="./.github/screenshots/sumbreak.png" /></td>
    <td><img alt="Sumbreak in the dark theme" src="./.github/screenshots/sumbreak-dark.png" /></td>
    <td></td>
  </tr>
</table>

<table>
  <tr>
    <th width="33%">Wend</th>
    <th width="33%">Wend, dark theme</th>
    <th width="33%"></th>
  </tr>
  <tr>
    <td><img alt="Wend board with three words found in colour and a fourth half traced in grey" src="./.github/screenshots/wend.png" /></td>
    <td><img alt="Wend in the dark theme" src="./.github/screenshots/wend-dark.png" /></td>
    <td></td>
  </tr>
</table>

<table>
  <tr>
    <th width="33%">Termo</th>
    <th width="33%">Termo, dark theme</th>
    <th width="33%"></th>
  </tr>
  <tr>
    <td><img alt="Termo with two words to find and three guesses played" src="./.github/screenshots/termo.png" /></td>
    <td><img alt="Termo in the dark theme" src="./.github/screenshots/termo-dark.png" /></td>
    <td></td>
  </tr>
</table>

The interface follows the system theme:

<table>
  <tr>
    <td width="33%"><img alt="Zip in the dark theme" src="./.github/screenshots/zip-dark.png" /></td>
    <td width="33%"><img alt="Patches in the dark theme" src="./.github/screenshots/patches-dark.png" /></td>
    <td width="33%"><img alt="Queens in the dark theme" src="./.github/screenshots/queens-dark.png" /></td>
  </tr>
</table>

The screenshots are not mockups. `npm run screenshots` plays every game against a running production build and saves what it sees.

## Routes

Every page lives under a locale, `/en` or `/pt-br`. The table leaves it out.

| Route | What it is |
|---|---|
| `/` | hub: every game, today's number and difficulty, your status and streak, the ranking of the week, countdown to the next boards |
| `/zip`, `/patches`, `/chess`, `/queens`, `/sumbreak`, `/wend`, `/termo` | today's puzzle |
| `/zip/practice` and the same under each game | pick a difficulty, a board size (Chess and Termo have one) and an optional seed |
| `/zip/play?seed=ZIP:lucky:1:hard:8` | an exact puzzle. The same seed always builds the same board, so links are shareable |
| `/rooms/new` | set up a challenge: the rounds, and the game, difficulty and size of each |
| `/rooms/NM73Y` | a challenge room: the invitation, the lobby, and the table of the race |
| `/ranking` | the ranking of today, the week, the month and all time, for all games or for one |
| `/profile` | your display name, nickname and avatar, and your account: create one with a passkey, or sign in |
| `/privacy`, `/terms` | what the site stores and why, and the rules of the site |

A path without a locale is redirected to the visitor's language: the one they chose before, or the one of their country and browser. So `/zip` and every link shared before the site had languages still work, and a shared link opens in the language of whoever opens it.

Old Zip links such as `/hard/42` redirect to the new practice route. The shortcut domains `zip.brunosilva.io` and `patches.brunosilva.io` redirect to their game on `play.brunosilva.io`.

## Languages

The interface comes in English and Brazilian Portuguese. The flag in the header switches between them and stays on the same page, and the choice is remembered.

The game language is a separate setting, found in the settings of the hub, Termo, Wend and Chess. It decides the words of Termo and Wend and the language the chess coach speaks. A player can read the interface in English and play Termo in Portuguese, or the other way around. Until it is set, the games follow the interface.

Termo and Wend are different puzzles in each language, so each language has its own daily puzzle, and a seed names its language: `TERMO:lucky:1:hard` is Portuguese and `TERMO:lucky:1:hard:en` is English. A shared link opens the words of its seed. The streak is one per game: a day counts once it is solved in either language.

## Playing together

A challenge room is a race through the same boards. From the practice setup of any game, "Challenge friends" opens the room setup: 1 to 10 rounds, each with its own game, difficulty and board size. The room gets a link to share. Everyone who opens it joins the lobby, and when the host starts, all players get the same seeds.

Each player's clock starts when their first board appears and only stops when their last round ends, even if they leave the page. More rounds solved wins, then the lower time. A hint adds 30 seconds, and a revealed puzzle counts as not solved. When someone finishes, the others get a short notice and can keep going or give up. No account is needed: a player is a name and a generated avatar kept in the browser.

## Ranking

A solved daily puzzle scores 100 points, minus 10 per hint, plus up to 50 for speed. The ranking shows today, this week, this month and all time, for all games together or for one. One game on one day is ranked by time, since everyone had the same puzzle. Practice and challenge rooms do not count.

## Profile and accounts

A player needs no account: the first score or the first room creates one, tied to the browser. Each player has a display name, free to pick, and a nickname that nobody else can have.

A daily puzzle counts once per player. Closed on one device, by solving it, revealing it or losing it, it is closed on every device of the account, which opens the same finished board. A clock started on one device keeps running on the next.

To be the same player on a phone and on a computer, create an account on the profile page. It uses a passkey: no password and no email. Any authenticator works, from Google Password Manager and iCloud Keychain to a security key. Signing in on a device that already has scores offers to add them to the account. The same page deletes the player and everything stored about it.

A first visit gets a short notice about cookies. The site sets only the ones it needs, and has no ads and no trackers. The [privacy policy](https://play.brunosilva.io/privacy) lists what is stored.

## How the games work

**Zip.** Press 1 and drag. The path moves to side neighbours, cannot cross itself or a wall, and must reach the numbers in order. The board is solved when the path covers every cell and ends on the last number. Drag backwards to rewind, or tap a cell on the path to cut it there. Boards go from 5x5 to 8x8.

Boards are themed by their seed. Walls form figures (a cross, a frame, a face, a pinwheel), some cells are blocked and the path goes around them, and the solution is often a drawing of its own: a spiral, a meander, or a path whose second half mirrors the first. Hard and expert boards hide some numbers behind a `?`. When a board is solved, the walls fade out and the path stays, with the numbers on it.

**Patches.** Press a clue and drag outward to draw its patch. A clue can give a cell count, a shape (square, tall, wide or any), both, or nothing (it then shows `?`). Patches cannot overlap and every cell must be covered. A patch can be drawn in several strokes: a partial one stays on the board as unfinished, and another drag from the clue or from the patch adds to it. Tap a patch to remove it. Boards go from 5x5 to 10x10.

**Chess.** Every puzzle opens with the opponent's last move, which is either a mistake to punish or a threat to answer. Drag a piece, or tap it and then the square. Easy puzzles take one move (a mate in one, or a piece left hanging), and expert ones are mates in three. A move that is legal but wrong stays on the board with a cross, and the coach, an owl called Sofia, says what it allows: the piece it loses, the mate it walks into, the king it lets escape. She speaks the game language, English or Portuguese, describes moves in words and never in notation ("the rook takes the bishop on e1"), and never names the move to find. A tap on the board takes the wrong move back. The first hint shows which piece moves, the second plays the move.

Puzzles are not taken from a database. The generator plays a game against itself from the starting position and stops at the first move that can be punished in exactly one way, so every position can be reached in a real game.

**Queens.** Tap a cell once for an X, twice for a queen. Dragging marks X's. Every row, column and coloured region takes exactly one queen, and two queens cannot touch, diagonals included. A queen that breaks a rule against one already on the board is refused, and cells that placed queens rule out get a small dot. Boards go from 5x5 to 10x10.

**Sumbreak.** Drag a number onto a side neighbour that holds the same number, or tap one and then the other. The two become one tile with their sum, on the cell that was dropped on. The other cell stays empty and nothing slides, so a number that ends up away from its next partner is stranded for good. The board is solved when one tile is left. A merge that ruins the board is still played, and the game only says so when you get stuck or ask for a hint, which then takes the board back to the last position that can be finished. Boards go from 3x3 to 5x5.

**Wend.** The board is a grid of letters that hides the words of one theme, such as fruits or football, and the list under it shows how long each word is. Drag through neighbouring letters to trace a word. A word turns as often as it likes, never moves diagonally and goes around the walls. A trail stays on the board in grey whether it spells anything or not, and turns into colour when it is one of the hidden words. Together the words use every letter once, so the last word is whatever is left. Tap the first letter of a trail to erase it. Portuguese words are laid out without accents. Boards go from 5x5 to 8x8, and the two harder tiers keep the theme secret until the first word is found.

**Termo.** Type a five-letter word and press Enter. Each letter is marked: right place, in the word but elsewhere, or not in the word. The on-screen keyboard keeps the best mark of every letter, and has keys to delete a letter and to clear the row. In Portuguese, accents are never typed: the game writes them when the row is played. The daily puzzle is always Termo: one word, six guesses. Dueto hides two words at once with seven guesses, and Quarteto four with nine. Each day has one Dueto and one Quarteto of its own, offered once the daily is over, and Practice has all three modes. A guess is final, so there is no undo and no reset, and running out of guesses ends the game.

All games share the same controls and rules around the board:

- **Undo**, **Hint**, **Reveal** and **Reset**, plus **New** in practice mode, which loads another board and restarts the clock. A hint acts: it removes a mistake if there is one, otherwise it plays the next forced move and says why. Reveal plays the whole solution piece by piece, and that puzzle then earns no streak and no best time. Termo has only Hint and Reveal, because a guess is final. A finished practice puzzle also offers **Try again**: the same board from the start, with a fresh clock. A replay sets no best time, since the answer has been seen.
- **The clock** starts the first time you see the board and only stops when the puzzle ends. Closing the tab does not pause it.
- **Daily puzzles** change at midnight Pacific Time and get harder from Monday to Sunday, except in Termo, where the daily is the same game every day. Finishing one extends that game's streak.
- **Sound and vibration** are on by default and can be turned off in the settings, which apply to every game.
- **The theme** follows the device until you pick one. The sun or moon in the header switches between light and dark, and the settings can go back to following the device.
- Everything works with the keyboard, and animations follow the system's reduced motion setting.

The game's mark at the top left leads back to the hub. Once a puzzle is under way it asks first, because the clock keeps running while you are away. The result screen suggests up to two games you have not finished today, and one more button leads to the hub for the rest.

Every generated puzzle has exactly one solution, proven by a solver before the board is shown, and Patches and Queens boards can always be solved by deduction alone. In Chess, "one solution" means one move at each step that mates in time or wins the material, checked by the engine's search. Sumbreak is the exception: many orders of merges solve a board, and the solver instead knows for every position whether it can still be finished. In Wend the hidden words fit on the board in exactly one way. Termo has nothing to prove: its puzzle is a word from a curated list. Zip measures how hard a board is by counting the wrong turns that only fail many cells later, and each difficulty aims for its own score.

## Project structure

```
src/
  app/        routes only: [locale]/ for the pages, api/ for the route handlers
  i18n/       locales, detection, navigation, message loading
  games/      registry.ts, zip/, patches/, chess/, queens/, sumbreak/, wend/, termo/ (each: engine, components, hooks, storage)
  shared/     engine, storage, platform, hooks, ui, online: everything the games have in common
  server/     database access, players, rooms, scores
messages/     translations, one folder per locale and one JSON file per namespace
public/       service worker, manifest, icons
scripts/      CLI tools per game, and the database migration
tests/        Vitest unit and bulk generation tests
e2e/          Playwright tests against the production build
docs/         architecture, languages, online features, seeds, and one folder per game
```

A game imports `shared` and never another game. Each `engine/` folder is pure TypeScript with no React or DOM, so it also runs from the command line. `docs/ARCHITECTURE.md` explains the layers and lists the steps to add a game.

The stack is Next.js 16, React 19, TypeScript and Tailwind CSS 4. The games themselves have no dependencies beyond React and Next.js. That includes chess: the move generator, the search and the board are written here. Five libraries serve the platform around them: [next-intl](https://next-intl.dev) for translations, the [Neon](https://neon.tech) serverless driver for the database, [DiceBear](https://www.dicebear.com) for the players' avatars (the "Thumbs" style, CC0), [SimpleWebAuthn](https://simplewebauthn.dev) for passkeys, and [TanStack Query](https://tanstack.com/query) for the data the pages keep fresh. Icons are hand-drawn SVG, sounds are synthesized with Web Audio, and the boards are DOM and SVG. The chess pieces are the Cburnett set from Wikimedia Commons, used under its BSD licence (notice in `docs/chess/CHESS.md`). Termo's Portuguese word lists are built from [fserb/pt-br](https://github.com/fserb/pt-br), used under its MIT licence. Its English lists are built from SCOWL, the public-domain ENABLE list and Google Books Ngram counts (CC BY 3.0). The notices are in the generated files and in `docs/termo/TERMO.md`. Wend's themed word banks, one per language, were written for this project.

## Getting started

```bash
git clone https://github.com/brunos3d/play.brunosilva.io.git
cd play.brunosilva.io
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In development each game shows a debug panel under the board with the seed, solver statistics and a switch that outlines the solution. The service worker only registers in production builds:

```bash
npm run build
npm start
```

The games need no configuration. Challenge rooms and the ranking need a Postgres database in `DATABASE_URL`. Without it they switch themselves off and everything else works. With access to the Vercel project:

```bash
vercel link
vercel env pull .env.local   # brings DATABASE_URL
npm run db:migrate           # creates the tables, safe to run again
```

[docs/ONLINE.md](docs/ONLINE.md) has the details.

## Commands

```bash
npm test                # Vitest: shared and every game, including bulk puzzle generation
npm run test:e2e        # Playwright: builds, serves and drives the production app
npm run lint
npm run typecheck
npm run icons           # render PNG icons from public/icons/*.svg
npm run og              # render the Open Graph images in public/og, once
npm run screenshots     # play every game on a running server and save the README screenshots
npm run db:migrate      # create or update the database tables (needs DATABASE_URL)

npm run zip:generate -- --seed 12345 --difficulty hard --solution
npm run zip:validate        # audits seeds, sizes and a year of dailies
npm run zip:benchmark

npm run patches:generate -- --seed 12345 --difficulty hard --solution
npm run patches:solve -- --seed 12345 --difficulty hard --steps
npm run patches:validate
npm run patches:benchmark

npm run chess:generate -- --seed 12345 --difficulty hard --solution
npm run chess:validate
npm run chess:benchmark
npm run chess:coach -- --seed 12345 --difficulty hard --lang pt-br   # print the coach's lines for a puzzle

npm run queens:generate -- --seed 12345 --difficulty hard --solution --steps
npm run queens:validate
npm run queens:benchmark

npm run sumbreak:generate -- --seed 12345 --difficulty hard --solution
npm run sumbreak:validate
npm run sumbreak:benchmark

npm run wend:generate -- --seed 12345 --difficulty hard --solution
npm run wend:validate
npm run wend:benchmark

npm run termo:generate -- --seed 12345 --difficulty hard --solution
npm run termo:validate
npm run termo:benchmark
npm run termo:words -- --data <folder with the fserb/pt-br files>   # rebuild the Portuguese word lists
npm run termo:words:en -- --data <folder with the English sources> # rebuild the English word lists
```

The e2e tests need Chromium once: `npx playwright install chromium`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): layers, the shared game frame, the clock, persistence, the visual system, PWA
- [Languages](docs/I18N.md): locales and how a visitor gets one, messages, the game language, seeds with a language
- [Challenge rooms](docs/MULTIPLAYER.md): how a race works, who wins, why polling and not WebSockets or WebRTC
- [Online features](docs/ONLINE.md): the database, players, nicknames, accounts with passkeys, the ranking and its points, the cookie notice and the legal pages
- [Seeds and daily puzzles](docs/SEEDS.md): determinism, seed format, versioning, Pacific time, streaks
- [Zip](docs/zip/ZIP.md): rules, solver, generator, tiers, interaction, benchmark
- [Chess](docs/chess/CHESS.md): engine, generator, recipes per tier, the coach, the board, benchmark
- [Chess and Queens research](docs/chess/RESEARCH.md): how chess.com, Lichess and LinkedIn do it, what was taken from each, and why no chess library is used
- [Queens](docs/queens/QUEENS.md): rules, solvers, generator, tiers, interaction, benchmark
- [Sumbreak](docs/sumbreak/SUMBREAK.md): how LinkedIn's game works, rules, solver, the difficulty measure, generator, benchmark
- [Wend](docs/wend/WEND.md): how LinkedIn's game works, the word bank, the one-solution check, generator, tiers, interaction
- [Termo](docs/termo/TERMO.md): how term.ooo works, rules, the word lists and their licence, tiers, interaction
- Patches: [reference notes](docs/patches/PATCHES_REFERENCE.md), [engine](docs/patches/PUZZLE_ENGINE.md), [generation](docs/patches/PUZZLE_GENERATION.md), [solver](docs/patches/SOLVER.md), [difficulty](docs/patches/DIFFICULTY.md)

## About

This project started as a single game. The first version of Zip was built with Claude Opus 4.6 as the AI coding assistant, in 10 prompts, as an experiment in how far iterative prompting could go. Patches, the shared platform, the rewrite of Zip on top of it, Chess, Queens, Sumbreak, Wend, Termo, the two languages, challenge rooms and the ranking followed the same way.

Made by [Bruno Silva](https://brunosilva.io).

## License

MIT
