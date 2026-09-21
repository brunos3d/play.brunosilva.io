import { rectCells } from "../board/geometry";
import { hasShapeRule } from "../clues/clue";
import { TIER_CONFIG, type TierConfig } from "../difficulty/config";
import { type DifficultyReport, evaluateDifficulty } from "../difficulty/evaluate";
import { regionFromRect, regionIdForClue } from "../regions/region";
import { type Rng, createRng, hashHex } from "@/shared/engine/prng";
import { GENERATOR_VERSION, type PuzzleSpec, formatSeed, isBoardSize, isSupportedVersion, normalizeToken, rngKey } from "../seed/spec";
import { buildCandidates } from "../solver/candidates";
import { solveWithLogic } from "../solver/logic";
import { solve } from "../solver/search";
import type { Clue, Difficulty, Puzzle, PuzzleShape, Rect, ShapeConstraint } from "../types";
import { randomPartition } from "./partition";

const MAX_ATTEMPTS = 40;
const MAX_REPAIR_ROUNDS = 40;
const MAX_TUNING_PASSES = 60;
/** Half-width of the window around a puzzle's target score that tuning accepts. */
const TARGET_TOLERANCE = 3;
/** Every board keeps at least this share of clues with a real shape icon, and never fewer than the minimum. */
const MIN_SHAPE_CLUE_SHARE = 0.15;
const MIN_SHAPE_CLUES = 2;
/** Chance that a clue without a real shape rule still shows the dashed "any shape" icon. */
const FREEFORM_ICON_CHANCE = { numbered: 0.2, numberless: 0.65 } as const;

export type GenerateOptions = {
  /** Board edge length. Missing lets the tier choose. */
  size?: number;
  /** Generator version to reproduce. Defaults to the current one. */
  version?: number;
};

type Draft = { rect: Rect; row: number; column: number; showArea: boolean; showShape: boolean };

type Assessment = { unique: boolean; report: DifficultyReport; initialForcedRatio: number };

function trueShape(rect: Rect): ShapeConstraint {
  if (rect.width === rect.height) return "square";
  return rect.height > rect.width ? "tall" : "wide";
}

/** Canonical clue order: row-major by clue cell. Scores are measured in this order and shipped in it. */
function sortDrafts(drafts: Draft[]): void {
  drafts.sort((a, b) => a.row - b.row || a.column - b.column);
}

function draftClues(drafts: readonly Draft[]): Clue[] {
  return drafts.map((draft, index) => {
    const clue: Clue = { id: `c${index}`, row: draft.row, column: draft.column };
    if (draft.showArea) clue.area = draft.rect.width * draft.rect.height;
    if (draft.showShape) clue.shape = trueShape(draft.rect);
    return clue;
  });
}

function assess(width: number, height: number, drafts: readonly Draft[]): Assessment {
  const shape: PuzzleShape = { width, height, clues: draftClues(drafts) };
  const candidates = buildCandidates(shape);
  const search = solve(shape, { candidates, maxSolutions: 2 });
  if (search.solutionCount !== 1) {
    return { unique: false, report: evaluateDifficulty(shape, { candidates, search, logic: { steps: [], solved: false, contradiction: false, waves: 0, eliminatedCandidates: 0 } }), initialForcedRatio: 0 };
  }
  const logic = solveWithLogic(shape, { candidates });
  const report = evaluateDifficulty(shape, { candidates, search, logic });
  return { unique: true, report, initialForcedRatio: report.metrics.forcedMoveCount / Math.max(1, drafts.length) };
}

function shapeClueFloor(clueCount: number): number {
  return Math.min(clueCount, Math.max(MIN_SHAPE_CLUES, Math.ceil(clueCount * MIN_SHAPE_CLUE_SHARE)));
}

/**
 * Shape icons are what set this game apart from plain Shikaku, so a board must
 * not lose them all to tuning. Adding information can never break uniqueness.
 */
function ensureShapeClues(rng: Rng, drafts: Draft[]): void {
  const missing = shapeClueFloor(drafts.length) - drafts.filter((draft) => draft.showShape).length;
  if (missing <= 0) return;
  const hidden = rng.shuffle(drafts.filter((draft) => !draft.showShape));
  for (const draft of hidden.slice(0, missing)) draft.showShape = true;
}

function bandDistance(score: number, band: readonly [number, number]): number {
  if (score < band[0]) return band[0] - score;
  if (score > band[1]) return score - band[1];
  return 0;
}

function initialInformation(rng: Rng, tier: TierConfig): Pick<Draft, "showArea" | "showShape"> {
  const mix = tier.clueMix;
  const kind = rng.weighted(["both", "areaOnly", "shapeOnly", "none"] as const, [mix.both, mix.areaOnly, mix.shapeOnly, mix.none]);
  return { showArea: kind === "both" || kind === "areaOnly", showShape: kind === "both" || kind === "shapeOnly" };
}

/**
 * Adds information until exactly one solution remains. Each round compares two
 * solutions, takes the clues whose rectangles differ, and strengthens the one
 * that says the least. When every differing clue already shows number and
 * shape, the clue cell moves to a spot the rival rectangle cannot reach.
 */
function repairUniqueness(rng: Rng, width: number, height: number, drafts: Draft[]): boolean {
  for (let round = 0; round < MAX_REPAIR_ROUNDS; round++) {
    sortDrafts(drafts);
    const shape: PuzzleShape = { width, height, clues: draftClues(drafts) };
    const result = solve(shape, { maxSolutions: 2 });
    if (result.solutionCount === 1) return true;
    if (result.solutionCount === 0) return false;

    const [first, second] = result.solutions;
    const differing = rng.shuffle(drafts.map((_, index) => index).filter((index) => JSON.stringify(first[index]) !== JSON.stringify(second[index])));
    const weakest = differing
      .filter((index) => !drafts[index].showArea || !drafts[index].showShape)
      .sort((a, b) => Number(drafts[a].showArea) + Number(drafts[a].showShape) - (Number(drafts[b].showArea) + Number(drafts[b].showShape)))[0];

    if (weakest !== undefined) {
      const draft = drafts[weakest];
      if (!draft.showArea) draft.showArea = true;
      else draft.showShape = true;
      continue;
    }

    let moved = false;
    for (const index of differing) {
      const draft = drafts[index];
      const rival = JSON.stringify(first[index]) === JSON.stringify(draft.rect) ? second[index] : first[index];
      const safeCells = rectCells(draft.rect).filter(
        (cell) => cell.row < rival.row || cell.row >= rival.row + rival.height || cell.column < rival.column || cell.column >= rival.column + rival.width,
      );
      if (safeCells.length > 0) {
        const cell = rng.pick(safeCells);
        draft.row = cell.row;
        draft.column = cell.column;
        moved = true;
        break;
      }
    }
    if (!moved) return false;
  }
  return false;
}

/**
 * Moves the score into the tier's band by hiding or revealing one piece of
 * information at a time. A change is kept only if the puzzle stays unique,
 * stays solvable by logic alone, and gets closer to the band.
 */
function tuneDifficulty(rng: Rng, width: number, height: number, drafts: Draft[], tier: TierConfig, window: readonly [number, number]): Assessment {
  let current = assess(width, height, drafts);

  for (let pass = 0; pass < MAX_TUNING_PASSES; pass++) {
    const distance = bandDistance(current.report.score, window);
    const tooManyOpenings = current.initialForcedRatio > tier.maxInitialForcedRatio;
    if (distance === 0 && !tooManyOpenings) break;

    const makeHarder = current.report.score < window[0] || (distance === 0 && tooManyOpenings);
    const canHideShape = drafts.filter((draft) => draft.showShape).length > shapeClueFloor(drafts.length);
    const moves: { index: number; field: "showArea" | "showShape" }[] = [];
    drafts.forEach((draft, index) => {
      if (draft.showArea === makeHarder) moves.push({ index, field: "showArea" });
      if (draft.showShape === makeHarder && (!makeHarder || canHideShape)) moves.push({ index, field: "showShape" });
    });

    let accepted = false;
    for (const move of rng.shuffle(moves)) {
      drafts[move.index][move.field] = !makeHarder;
      const next = assess(width, height, drafts);
      const fair = next.unique && next.report.metrics.guessCount <= tier.maxGuesses;
      const closer = makeHarder
        ? next.report.score <= window[1] && (bandDistance(next.report.score, window) < distance || (distance === 0 && next.initialForcedRatio < current.initialForcedRatio))
        : bandDistance(next.report.score, window) < distance;
      if (fair && closer) {
        current = next;
        accepted = true;
        break;
      }
      drafts[move.index][move.field] = makeHarder;
    }
    if (!accepted) break;
  }
  return current;
}

function decorate(rng: Rng, clues: Clue[]): Clue[] {
  return clues.map((clue) => {
    if (hasShapeRule(clue)) return clue;
    const chance = clue.area === undefined ? FREEFORM_ICON_CHANCE.numberless : FREEFORM_ICON_CHANCE.numbered;
    return rng.chance(chance) ? { ...clue, shape: "freeform" as const } : clue;
  });
}

function buildAttempt(key: string, attempt: number, size: number, tier: TierConfig): { drafts: Draft[]; assessment: Assessment } | null {
  const rng = createRng(`${key}|attempt|${attempt}`);
  const target = tier.targetRange[0] + rng.next() * (tier.targetRange[1] - tier.targetRange[0]);
  const window: [number, number] = [
    Math.max(tier.scoreBand[0], target - TARGET_TOLERANCE),
    Math.min(tier.scoreBand[1], target + TARGET_TOLERANCE),
  ];
  const rects = randomPartition(rng, { width: size, height: size, meanArea: tier.meanArea, areaSpread: tier.areaSpread });
  rects.sort((a, b) => a.row - b.row || a.column - b.column);

  const drafts: Draft[] = rects.map((rect) => {
    const cell = rng.pick(rectCells(rect));
    return { rect, row: cell.row, column: cell.column, ...initialInformation(rng, tier) };
  });

  if (!repairUniqueness(rng, size, size, drafts)) return null;
  sortDrafts(drafts);
  ensureShapeClues(rng, drafts);
  const assessment = tuneDifficulty(rng, size, size, drafts, tier, window);
  return assessment.unique ? { drafts, assessment } : null;
}

/**
 * Builds the puzzle for a spec. The output depends only on the spec: the PRNG
 * is keyed by token, version, difficulty and size, and each attempt gets its own
 * stream, so attempt N is the same no matter how earlier attempts went.
 */
export function generateFromSpec(spec: PuzzleSpec): Puzzle {
  if (!isSupportedVersion(spec.version)) {
    throw new RangeError(`Generator version ${spec.version} is not available in this build.`);
  }
  if (spec.size !== undefined && !isBoardSize(spec.size)) {
    throw new RangeError(`Board size ${spec.size} is out of range.`);
  }
  const tier = TIER_CONFIG[spec.difficulty];
  const key = rngKey(spec);
  const size = spec.size ?? createRng(`${key}|size`).pick(tier.sizes);

  let best: { drafts: Draft[]; assessment: Assessment; attempt: number; penalty: number } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const built = buildAttempt(key, attempt, size, tier);
    if (!built) continue;
    const { report } = built.assessment;
    const penalty =
      bandDistance(report.score, tier.scoreBand) +
      Math.max(0, report.metrics.guessCount - tier.maxGuesses) * 50 +
      Math.max(0, built.assessment.initialForcedRatio - tier.maxInitialForcedRatio) * 20;
    if (!best || penalty < best.penalty) best = { ...built, attempt, penalty };
    if (penalty === 0) break;
  }

  if (!best) throw new Error(`No unique puzzle found for seed ${formatSeed(spec)}`);

  const orderedDrafts = best.drafts;
  const clues = decorate(createRng(`${key}|icons`), draftClues(orderedDrafts));
  const shareSeed = formatSeed({ ...spec, token: normalizeToken(spec.token) });

  return {
    id: patchesPuzzleId(shareSeed),
    seed: shareSeed,
    version: spec.version,
    width: size,
    height: size,
    difficulty: spec.difficulty,
    clues,
    solution: orderedDrafts.map((draft, index) => regionFromRect(regionIdForClue(clues[index].id), clues[index].id, draft.rect)),
    metadata: {
      generatorVersion: spec.version,
      shareSeed,
      difficultyScore: best.assessment.report.score,
      measuredDifficulty: best.assessment.report.tier,
      metrics: best.assessment.report.metrics,
      attempts: best.attempt,
    },
  };
}

/** Id of the puzzle a canonical seed builds. Lets the hub look up a saved board without generating it. */
export const patchesPuzzleId = (shareSeed: string): string => `patches-${hashHex(shareSeed).slice(0, 12)}`;

/** `generatePuzzle("example-seed", "hard")` always returns the same puzzle. */
export function generatePuzzle(seed: string | number, difficulty: Difficulty, options: GenerateOptions = {}): Puzzle {
  return generateFromSpec({
    token: normalizeToken(seed),
    version: options.version ?? GENERATOR_VERSION,
    difficulty,
    ...(options.size !== undefined ? { size: options.size } : {}),
  });
}
