# Minigames

A small platform of daily logic puzzles, playable at [play.brunosilva.io](https://play.brunosilva.io/). It currently has two games, both inspired by the LinkedIn games of the same name:

- **Zip**: draw one path through every cell, passing the numbers in order.
- **Patches**: cover the grid with rectangles so that each one holds exactly one clue.

Every game gets one new board per day, the same for every player, plus unlimited practice. There is no server state. Puzzles are generated in the browser from a seed, and progress, streaks and best times stay on the device. The app installs as a PWA and plays offline after the first visit.

## Routes

| Route | What it is |
|---|---|
| `/` | hub: every game, today's number and difficulty, your status and streak, countdown to the next boards |
| `/zip`, `/patches` | today's puzzle |
| `/zip/practice`, `/patches/practice` | pick a difficulty, a board size and an optional seed |
| `/zip/play?seed=ZIP:lucky:1:hard:8` | an exact puzzle. The same seed always builds the same board, so links are shareable |

Old Zip links such as `/hard/42` redirect to the new practice route. The shortcut domains `zip.brunosilva.io` and `patches.brunosilva.io` redirect to their game on `play.brunosilva.io`.

## How the games work

**Zip.** Press 1 and drag. The path moves to side neighbours, cannot cross itself or a wall, and must reach the numbers in order. The board is solved when the path covers every cell and ends on the last number. Drag backwards to rewind, or tap a cell on the path to cut it there. Boards go from 5x5 to 8x8.

**Patches.** Press a clue and drag outward to draw its patch. A clue can give a cell count, a shape (square, tall, wide or any), both, or nothing. Patches cannot overlap and every cell must be covered. Tap a patch to remove it. Boards go from 5x5 to 10x10.

Both games share the same controls and rules around the board:

- **Undo**, **Hint**, **Reveal** and **Reset**. A hint acts: it removes a mistake if there is one, otherwise it plays the next forced move and says why. Reveal plays the whole solution piece by piece, and that puzzle then earns no streak and no best time.
- **The clock** starts the first time you see the board and only stops when the puzzle ends. Closing the tab does not pause it.
- **Daily puzzles** change at midnight Pacific Time and get harder from Monday to Sunday. Finishing one extends that game's streak.
- **Sound and vibration** are on by default and can be turned off in the settings, which apply to every game.
- Everything works with the keyboard, and the layout follows the system's light or dark theme and its reduced motion setting.

Every generated puzzle has exactly one solution, proven by a solver before the board is shown, and Patches boards can always be solved by deduction alone.

## Project structure

```
src/
  app/        routes only
  games/      registry.ts, zip/, patches/ (each: engine, components, hooks, storage)
  shared/     engine, storage, platform, hooks, ui: everything the games have in common
public/       service worker, manifest, icons
scripts/      CLI tools per game
tests/        Vitest unit and bulk generation tests
e2e/          Playwright tests against the production build
docs/         architecture, seeds, and one folder per game
```

A game imports `shared` and never another game. Each `engine/` folder is pure TypeScript with no React or DOM, so it also runs from the command line. `docs/ARCHITECTURE.md` explains the layers and lists the steps to add a game.

The stack is Next.js 16, React 19, TypeScript and Tailwind CSS 4, with no runtime dependencies beyond React and Next.js. Icons are hand-drawn SVG, sounds are synthesized with Web Audio, and the boards are DOM and SVG.

## Getting started

```bash
git clone https://github.com/brunos3d/zip.git
cd zip
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In development each game shows a debug panel under the board with the seed, solver statistics and a switch that outlines the solution. The service worker only registers in production builds:

```bash
npm run build
npm start
```

## Commands

```bash
npm test                # Vitest: shared, zip and patches, including bulk puzzle generation
npm run test:e2e        # Playwright: builds, serves and drives the production app
npm run lint
npm run typecheck
npm run icons           # render PNG icons from public/icons/*.svg

npm run zip:generate -- --seed 12345 --difficulty hard --solution
npm run zip:validate        # audits seeds, sizes and a year of dailies
npm run zip:benchmark

npm run patches:generate -- --seed 12345 --difficulty hard --solution
npm run patches:solve -- --seed 12345 --difficulty hard --steps
npm run patches:validate
npm run patches:benchmark
```

The e2e tests need Chromium once: `npx playwright install chromium`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): layers, the shared game frame, the clock, persistence, the visual system, PWA
- [Seeds and daily puzzles](docs/SEEDS.md): determinism, seed format, versioning, Pacific time, streaks
- [Zip](docs/zip/ZIP.md): rules, solver, generator, tiers, interaction, benchmark
- Patches: [reference notes](docs/patches/PATCHES_REFERENCE.md), [engine](docs/patches/PUZZLE_ENGINE.md), [generation](docs/patches/PUZZLE_GENERATION.md), [solver](docs/patches/SOLVER.md), [difficulty](docs/patches/DIFFICULTY.md)

## About

This project started as a single game. The first version of Zip was built with Claude Opus 4.6 as the AI coding assistant, in 10 prompts, as an experiment in how far iterative prompting could go. Patches, the shared platform and the rewrite of Zip on top of it followed the same way.

Made by [Bruno Silva](https://brunosilva.io).

## License

MIT
