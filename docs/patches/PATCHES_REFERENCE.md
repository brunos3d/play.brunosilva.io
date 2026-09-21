# Patches reference notes

Research on LinkedIn's Patches game, compiled on 2026-09-21, and what each finding means for this implementation. Nobody on this project played the original while writing this. Everything below comes from public pages, so UI details that no page describes are listed as unknown, and the choice made here is stated next to them.

Confidence labels: **official** (LinkedIn Help, LinkedIn posts, the Coolmath listing that credits LinkedIn as developer, the designer's blog), **multi** (several independent third parties agree), **single**, **inferred**, **unknown**.

## Sources

- LinkedIn Help, "Patches": https://www.linkedin.com/help/linkedin/answer/a10314037 (fetched twice, quotes below match)
- Coolmath listing: https://www.coolmathgames.com/0-patches-by-linkedin
- Thomas Snyder's launch post: https://www.gmpuzzles.com/blog/2026/03/say-hi-to-patches/
- Press: PocketGamer.biz, GamesBeat, Social Media Today
- Solution archive used to check real boards: https://linkedinzip.solutions/archive/patches/
- Guides: techwiser.com, thewordfinder.com, patchesanswer.com, lofiandgames.com
- Share texts copied from public LinkedIn posts

Clone sites (patchesgame.com and similar) describe their own UI: orange and red borders, star ratings, a pulsing yellow hint. Those details are not evidence about the original and were ignored.

## Rules

The Help article gives three rules (official):

- "Fill the entire grid without overlapping shapes."
- "Each shape must include one clue cell."
- "Every cell must belong to exactly one shape."

Every patch is a rectangle, squares included (multi). LinkedIn told the press the grid is filled "using rectangles and squares", Coolmath says "Shapes are either squares, tall rectangles, or wide rectangles", and all nine archived solutions checked are rectangle tilings. The designer calls it "a region division puzzle with traits of Shikaku and Tatamibari".

Implementation: a region is an axis-aligned rectangle. The engine still stores the cell list and derives area, width, height and shape from it on every validation, so a non-rectangular cell set is detected and rejected instead of trusted. The number of regions in a solution always equals the number of clues.

## Clue semantics

The Help article lists four kinds of clue cell (official):

- "A number indicating the shape's size"
- "A shape icon (square, tall rectangle, wide rectangle, or freeform)"
- "Both a number and shape icon"
- "Neither, you determine both the size and shape"

| Constraint | Meaning here | Confidence |
|---|---|---|
| number `n` | area is exactly `n` cells | official |
| `square` | width = height | multi |
| `tall` | height > width, strictly | inferred from "taller than it is wide" |
| `wide` | width > height, strictly | inferred from "wider than it is tall" |
| `freeform` | any rectangle: tall, wide or square | official (Coolmath: "one special shape that can be a tall rectangle, wide rectangle, or square") |
| no icon (`unconstrained`) | any rectangle | official |

"Freeform" is the name of an icon. It does not allow polyominoes or disconnected cells. `freeform` and `unconstrained` therefore accept the same rectangles. They stay separate values because they render differently: one shows the dashed icon, the other shows nothing.

Tall does not mean a one-cell-wide strip. LinkedIn's launch video treats "8 tall" as 2 wide by 4 high. One guide shows only 1xN examples for the tall icon, which is misleading.

A 1x1 patch is treated as a square. No source discusses it and none of the checked solutions contains one. The generator avoids 1x1 patches for that reason.

Numberless clues are common (puzzle #188 has three of six, and #184 is titled "Where are the Numbers?"). After the player draws a patch for a numberless clue, the original shows the cell count on it (single source). This implementation does the same.

## Boards

Observed (archive data, area sums verified):

| Puzzle | Date | Day | Grid | Patches |
|---|---|---|---|---|
| #1 | 2026-03-18 | Wed | 5x5 | 5 |
| #176 | 2026-09-09 | Wed | 7x7 | 8 |
| #182 | 2026-09-15 | Tue | 6x6 | 8 |
| #183 | 2026-09-16 | Wed | 7x7 | 9 |
| #184 | 2026-09-17 | Thu | 6x6 | 10 |
| #185 | 2026-09-18 | Fri | 7x7 | 8 |
| #186 | 2026-09-19 | Sat | 8x8 | 16 |
| #187 | 2026-09-20 | Sun | 7x7 | 14 |
| #188 | 2026-09-21 | Mon | 6x6 | 6 |

All boards are square and range from 5x5 to 8x8. One site claims 10x10 exists (single, unverified). Patch count tracks difficulty more closely than board size: Sunday's 7x7 has 14 small patches while Friday's 7x7 has 8.

Implementation: the daily rotation uses 5x5 to 8x8. Practice mode offers 5x5 to 10x10. The engine takes width and height separately, so non-square boards work even though no mode generates them. Difficulty is scored from solver behaviour and clue information, not from size alone.

## Interaction

- "Drag across cells to draw a shape that includes a clue cell. To delete a shape, click or tap it." (official)
- Coolmath: "If the shape you made was incorrect, click on it to remove it from the grid."

That second sentence implies a patch that obeys its clue but is wrong for the solution still gets placed. How the original shows an illegal drag is unknown, as is whether a drag must start on the clue cell, whether patches can be resized, and whether drawing over a patch replaces it.

Choices made here, revised after play-testing feedback from the project owner:

- A drag starts on a clue cell, as Coolmath's "click on a numbered cell and drag" describes. A press on an empty cell never draws. If the player drags from one anyway, a message says where to start.
- The drag paints. The patch is the bounding rectangle of the clue and every cell the pointer has visited, so it only grows while the drag lasts. The first version used a plain rectangle from the press cell to the current cell. With that, a clue could only sit in a corner of its patch: dragging up from a clue in the middle row and then back down dropped the rows above, and the player had to start the drag from an outside corner instead.
- The preview has three states. It is valid when the rectangle holds exactly one clue and satisfies it. It is pending when it is not legal yet but can still grow into a legal patch: 4 cells of a 5, or a 2x2 start for a tall clue. It is invalid when it can never become legal: it holds another clue, overlaps another patch, exceeds the clue's number, or has no room left for the clue's shape.
- The label on the preview counts cells, for example `4/5`, or just `4` when the clue has no number. It used to show the dimensions (`2x2`), which says little about how far the patch is from its number.
- Releasing a pending rectangle keeps it on the board as an unfinished patch: lighter, with a dashed outline and its count. The player finishes it with another stroke, from the clue or from any cell of the patch. The strokes add up: the patch becomes the smallest rectangle around all of them. The shape of a clue is only judged once the patch has its full size, because a tall patch can pass through a square on the way. A board with an unfinished patch is never complete.
- The preview never runs over another clue or another patch. It stops at their edge while the pointer keeps moving, so a long swipe cannot turn a good stroke into a refused one.
- Releasing an invalid rectangle places nothing. The board shakes briefly and a text message names the reason. If the stroke started on an existing patch, that patch stays as it was.
- A legal but wrong patch is placed and stays. The game does not comment on it, so the player can follow a wrong path and back out by tapping patches. Only a hint points at a patch that cannot be part of the solution.
- Overlap with another clue's patch is invalid. The player removes that patch first.
- Drawing again from a clue or a patch grows that patch in one undoable step. It does not count as a redraw. To make a patch smaller, the player taps it off and draws again.
- A clue without a number shows `?`, with or without a shape icon, until a patch gives it a size. Harder tiers have more of them.
- A drag is cancelled by releasing outside the board or pressing Escape. Since a drag cannot shrink, this is how the player backs out of an overshoot.

## Controls

Official wording:

- "click or tap Hint to highlight a cell or region and show you the next step"
- "click or tap Undo to revert your last move"
- "click or tap Reset to clear the grid"

Hint limits, cooldowns, time penalties and whether Reset restarts the timer are unknown.

Choices made here: hints are unlimited and counted, and a hint acts. It first checks placed patches against the unique solution. If one is wrong, the hint flags it and takes it off the board. Otherwise it places the next patch the solver can prove, cell by cell from the clue outward, with a one-sentence reason. Reset clears the patches and the undo history but leaves the clock, the hint count and the redraw count alone, so resetting cannot improve a daily result.

Reveal is a fourth control, shared with Zip. After a confirmation it removes wrong patches and then places the missing ones, one piece at a time. A revealed puzzle ends the day but earns no streak credit and no best time, and its result cannot be shared. On a finished board the clue badges fade out, so what remains is the quilt.

## Results and sharing

Share texts seen on LinkedIn follow one template (the emoji is a ball of yarn):

```
Patches #57 | 0:29 <yarn> With no hints & 1 redraw lnkd.in/patches.
Patches #36 | 0:39 <yarn> With no redraws lnkd.in/patches.
```

The original therefore tracks time, hints and "redraws". It has no emoji grid. It also shows streaks and leaderboards after completion (official). The results layout and any badges are unknown.

Implementation: a redraw is counted every time a placed patch leaves the board through a tap or an Undo. The result screen shows puzzle number, time, difficulty, hints, redraws, streak and personal best. The share text uses this project's own multi-line format and its own URL. Leaderboards need accounts and a server, so they are out of scope.

## Schedule

- "A new puzzle for each game is released daily at midnight Pacific Time (PT)." (official)
- Puzzle #1 ran on 2026-03-18 and numbering is contiguous: #168 on 09-01, #176 on 09-09, #188 on 09-21 (multi). PocketGamer's "March 19th" is the outlier.
- Difficulty rises from Monday to Sunday (multi: GamesBeat, FandomWire, and the size data above).

Implementation: the canonical date is the calendar date in `America/Los_Angeles`. Puzzle number = days since 2026-03-18, plus 1, so numbers line up with the original. The epoch and the weekday table are configuration.

## Puzzle design

The original puzzles are hand-made by Grandmaster Puzzles authors and each has a title (official). No official statement on uniqueness was found, but a single solution is the genre convention.

Implementation: puzzles here are procedural, so there are no titles. The generator accepts a puzzle only when the solver proves exactly one solution, and it tunes clue information until the difficulty score lands in the band for the requested tier.

## Visual design

Known: patches are colourful and each has its own colour (official listing). Answer sites name clues by colour before anything is drawn ("the green patch"), so the colour belongs to the clue and the clue cell is tinted from the start (multi). Guides describe the number sitting inside a badge whose outline encodes the shape, and a dashed icon for freeform.

Unknown: hex values, borders, radii, the completion animation and the tutorial flow. Commenters on the launch post complained that the timer runs while the rules are still on screen.

Implementation: an original pastel palette assigned per clue, a badge per clue whose outline is a square, a tall rectangle, a wide rectangle or a dashed box, and the number inside it. The board is made of rounded square tiles. Empty cells, clue cells and placed patches share one gap and one corner radius, so a patch covers the tiles under it exactly. The clock starts the first time the player sees the board and never while the tutorial covers it. It then runs on wall time until the puzzle ends, even with the tab hidden or closed, so leaving to look something up does not stop it. See `docs/ARCHITECTURE.md`.

## Strategies found in guides

These drive the hint explanations and the difficulty model.

1. Prime areas (2, 3, 5, 7) can only be 1xN strips, and a tall or wide icon fixes the orientation. LinkedIn's video says to "look for the odd numbered clues first".
2. Number plus icon often leaves one size: 9 with a square icon is 3x3.
3. Clues near edges and corners have fewer ways to grow. Work from the outside in.
4. If only one patch can reach a cell, that patch is forced.
5. Do not strand a cell that no clue can reach.
6. Place big squares and long strips first. Resolve numberless clues last, from the space left over.

Solver mapping: items 1 to 3 are the "single candidate for a clue" technique, item 4 is "single candidate for a cell", item 5 is candidate elimination by lookahead. See `SOLVER.md` and `DIFFICULTY.md` in this folder.
