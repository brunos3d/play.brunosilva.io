import type { GameId } from "@/games/registry";
import { addDays } from "@/shared/engine/pacific-time";
import { STORES, idbGet, idbSet } from "@/shared/storage/idb";
import { type DailyResult, clearBoard, deleteDailyResult, loadAllDailyResults, loadBoard, loadDailyResult, putDailyResult, saveBoard } from "@/shared/storage/progress";
import { OnlineError, online } from "./api";
import type { DailyRecord, DailyState, ScoreSubmission } from "./types";
import { refreshPlayer } from "./use-player";

/**
 * Keeps a device's dailies in line with the player's. Progress lives on each
 * device, in IndexedDB, and that is still where every page reads it from. But
 * a player with an account plays on several devices, and a daily closed on
 * the phone has to be closed on the computer: the same puzzle must not be
 * played for points twice.
 *
 * So when a page loads, the device asks the server how the player's dailies
 * stand and writes what it is missing: the result, which is what the hub
 * shows, and the finished board, which is what the game page opens. The
 * server's record is the first close on any device, so it replaces a local
 * result that disagrees.
 *
 * A device is not a player: someone signs out, or another person signs in.
 * The dailies the server confirmed for one player are listed in a ledger and
 * taken out of the device when its player changes, so one player's closed
 * days never close the day for the next. They come back with the next sync
 * of that player.
 */

/** Fired on `window` after a sync changed what is stored. The hub reads its cards again. */
export const DAILY_SYNC_EVENT = "minigames:daily-sync";

/** A page waits this long for a sync before it shows the daily anyway. Slow networks do not get to hold the puzzle hostage. */
export const SYNC_WAIT_MS = 2_500;
/** A sync this recent is good enough for the next page: moving from the hub to a game does not ask again. */
const FRESH_MS = 15_000;

const LEDGER_KEY = "sync:ledger";
const OUTBOX_KEY = "sync:outbox";

/** The closed dailies the server confirmed, and for whom. Results are "game|variant|date", boards "game|puzzleId". */
type Ledger = { player: string | null; results: string[]; boards: string[] };
/** A close the server has not heard of yet, because the device was offline when it happened. */
type Pending = { player: string | null; score: ScoreSubmission };

const resultKey = (game: GameId, variant: string | undefined, date: string): string => `${game}|${variant ?? ""}|${date}`;
const boardKey = (game: GameId, puzzleId: string): string => `${game}|${puzzleId}`;

const isFinished = (board: unknown): boolean => typeof (board as { finishedMs?: unknown } | null | undefined)?.finishedMs === "number";

/**
 * The result a device stores for a record of the server. The count of moves
 * is the exception: a close from before the server kept it, or a reveal
 * reported before its board was done, says 0, and the device's own count is
 * the better one.
 */
function toResult(record: DailyRecord, local: DailyResult | undefined): DailyResult {
  return {
    game: record.game,
    ...(record.variant ? { variant: record.variant } : {}),
    date: record.date,
    number: record.number,
    difficulty: record.difficulty,
    seed: record.seed,
    elapsedMs: record.elapsedMs,
    hintsUsed: record.hints,
    mistakes: record.mistakes,
    moves: record.moves || local?.moves || 0,
    revealed: record.outcome !== "solved",
    ...(record.outcome === "failed" ? { failed: true } : {}),
    ...(record.outcome === "solved" ? { points: record.points } : {}),
  };
}

const sameResult = (a: DailyResult, b: DailyResult): boolean =>
  a.elapsedMs === b.elapsedMs && a.hintsUsed === b.hintsUsed && a.mistakes === b.mistakes && a.moves === b.moves && a.revealed === b.revealed && Boolean(a.failed) === Boolean(b.failed) && a.points === b.points;

/** The submission that would have produced a record, for sending its board after the fact. */
function toSubmission(record: DailyRecord, board: unknown): ScoreSubmission {
  return {
    game: record.game,
    ...(record.variant ? { variant: record.variant } : {}),
    date: record.date,
    number: record.number,
    difficulty: record.difficulty,
    size: record.size,
    elapsedMs: Math.max(record.elapsedMs, 1_000),
    hintsUsed: record.hints,
    mistakes: record.mistakes,
    moves: record.moves,
    revealed: record.outcome !== "solved",
    failed: record.outcome === "failed",
    board,
  };
}

/**
 * True when a finished board on this device can be the board of a close: it
 * did not take longer than the close did. The server's time is the device's,
 * or more when its clock for the puzzle started earlier. A board that took
 * longer belongs to another, later solve of the same daily.
 */
const boardIsOf = (board: unknown, record: DailyRecord): boolean => (board as { finishedMs: number }).finishedMs <= record.elapsedMs + 1_000;

/** Boards this page has already tried to send. The server may refuse one for good, and asking again on the next sync changes nothing. */
const offered = new Set<string>();

type Applying = {
  ledger: Ledger;
  /** The result the device has for this daily, read by the caller. */
  local: DailyResult | undefined;
  /**
   * The first date whose board can still travel: yesterday, by the server's
   * calendar. Older boards are not sent by the server and not taken by it, so
   * neither side has anything to do about them. Null leaves boards alone.
   */
  boardsFrom: string | null;
  /** Collects boards this device has and the server lacks. Null when the caller is not going to send any. */
  uploads: ScoreSubmission[] | null;
};

/** Brings the device's storage in line with one record. Returns true when something stored changed. */
async function applyRecord(record: DailyRecord, { ledger, local, boardsFrom, uploads }: Applying): Promise<boolean> {
  let changed = false;
  const wanted = toResult(record, local);
  if (!local || !sameResult(local, wanted)) {
    await putDailyResult(wanted);
    changed = true;
  }
  const key = resultKey(record.game, record.variant, record.date);
  if (!ledger.results.includes(key)) ledger.results.push(key);

  // The board of a closed daily is the player's too, whether a sync wrote it or the player finished it here.
  const board = boardKey(record.game, record.puzzleId);
  if (!ledger.boards.includes(board)) ledger.boards.push(board);
  if (boardsFrom === null || record.date < boardsFrom) return changed;

  const stored = await loadBoard(record.game, record.puzzleId);
  if (record.board !== null) {
    // The day is closed, and the server's board is the board of the close that counts. A board this device left half
    // played gives way to it, and so does a finished one of another close: the device's own later solve of a daily that
    // was closed first elsewhere.
    if (!isFinished(stored) || JSON.stringify(stored) !== JSON.stringify(record.board)) {
      await saveBoard(record.game, record.puzzleId, record.board);
      changed = true;
    }
  } else if (isFinished(stored) && boardIsOf(stored, record) && uploads && !offered.has(board)) {
    // The close reached the server without its board: it is older than boards, or it is the solve that created the player.
    offered.add(board);
    uploads.push(toSubmission(record, stored));
  }
  return changed;
}

/** Takes out the results and boards of another player's closed dailies. What this device recorded by itself, and the server never confirmed for anyone, stays. */
async function forget(ledger: Ledger): Promise<void> {
  for (const key of ledger.results) {
    const [game, variant, date] = key.split("|");
    await deleteDailyResult(game as GameId, date, variant || undefined);
  }
  for (const key of ledger.boards) {
    const separator = key.indexOf("|");
    await clearBoard(key.slice(0, separator) as GameId, key.slice(separator + 1));
  }
}

/** Dailies the player has open on some device, as the instant they were first opened on this device's clock. */
const opened = new Map<string, number>();
/** The player the last sync answered for. `undefined` until one has on this page. */
let knownPlayer: string | null | undefined;
/** True on a site that runs without a database: there is nothing to sync with, now or on the next page. */
let unavailable = false;
let running: Promise<void> | null = null;
let answeredAt = 0;

/** When the player first opened a daily, on this device's clock, or null when no device of theirs has. Read after a sync. */
export function firstOpenedAt(game: GameId, variant: string | undefined, date: string): number | null {
  return opened.get(resultKey(game, variant, date)) ?? null;
}

/** True once a sync has learned that the site has no server side to talk to. The frame then keeps its own reports to itself. */
export const dailyUnavailable = (): boolean => unavailable;

/** Resolves true when the server answered. */
async function run(): Promise<boolean> {
  let state: DailyState;
  try {
    state = await online.daily();
  } catch {
    // Offline. The device goes on with what it has.
    return false;
  }
  if (state.unavailable) {
    unavailable = true;
    return true;
  }
  let changed = false;

  const stored = await idbGet<Ledger>(STORES.stats, LEDGER_KEY);
  let ledger: Ledger = stored ?? { player: state.player, results: [], boards: [] };
  if (ledger.player !== state.player) {
    await forget(ledger);
    changed = ledger.results.length > 0 || ledger.boards.length > 0;
    ledger = { player: state.player, results: [], boards: [] };
  }
  knownPlayer = state.player;
  const boardsFrom = addDays(state.today, -1);

  // Closes that could not be sent when they happened. Each belongs to whoever the device was then, and waits for that
  // player's sync. One whose puzzle can no longer be played has nothing left to wait for.
  const pending = (await idbGet<Pending[]>(STORES.stats, OUTBOX_KEY)) ?? [];
  const kept: Pending[] = [];
  const records = [...state.records];
  for (const entry of pending) {
    if (entry.score.date < boardsFrom) continue;
    if (entry.player !== ledger.player) {
      kept.push(entry);
      continue;
    }
    try {
      const answer = await online.submitScore(entry.score);
      // A solve made offline by a device without a player creates the player when it arrives. The ledger was nobody's
      // and held nothing, and is that player's from here on, as are the other closes still waiting.
      if (answer.player && answer.player !== ledger.player) {
        ledger.player = answer.player;
        knownPlayer = answer.player;
        for (const waiting of kept) if (waiting.player === null) waiting.player = answer.player;
        refreshPlayer();
      }
      if (answer.record) records.push(answer.record);
    } catch (error) {
      if (!(error instanceof OnlineError) || error.status === 0 || error.status >= 500) kept.push(entry);
    }
  }
  if (pending.length > 0) await idbSet(STORES.stats, OUTBOX_KEY, kept);

  // Newest first: a page that is waiting on this sync is waiting for today.
  records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const locals = new Map<string, DailyResult>();
  for (const result of await loadAllDailyResults()) locals.set(resultKey(result.game, result.variant, result.date), result);
  const uploads: ScoreSubmission[] = [];
  for (const record of records) {
    const local = locals.get(resultKey(record.game, record.variant, record.date));
    changed = (await applyRecord(record, { ledger, local, boardsFrom, uploads })) || changed;
  }
  await idbSet(STORES.stats, LEDGER_KEY, ledger);

  opened.clear();
  const now = Date.now();
  for (const open of state.opens) opened.set(resultKey(open.game, open.variant, open.date), now - open.openedAgoMs);

  if (changed && typeof window !== "undefined") window.dispatchEvent(new Event(DAILY_SYNC_EVENT));
  // Boards the server lacks go up last and in the background: nothing on this device waits for them.
  for (const upload of uploads) void online.submitScore(upload).catch(() => undefined);
  return true;
}

/**
 * Syncs the device with the player's dailies. Calls made while one is running
 * share it, and a sync the server just answered is not repeated unless `force`
 * asks: signing in, signing out and merging change who the player is.
 */
export function syncDaily(force = false): Promise<void> {
  if (unavailable) return Promise.resolve();
  if (running) return force ? running.then(() => syncDaily(true)) : running;
  if (!force && answeredAt > 0 && Date.now() - answeredAt < FRESH_MS) return Promise.resolve();
  running = run()
    .then((answered) => {
      // Only an answer makes the device up to date. After a failure the next page asks again.
      if (answered) answeredAt = Date.now();
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** The ledger of the device, or a new one for the player the device was last known to be. */
async function currentLedger(): Promise<Ledger> {
  return (await idbGet<Ledger>(STORES.stats, LEDGER_KEY)) ?? { player: knownPlayer ?? null, results: [], boards: [] };
}

/**
 * Takes the server's answer to a close this device just reported. The record
 * is how the daily stands for the player, which is not this device's own
 * numbers when the server knew better: an earlier close on another device, or
 * a clock that started before this device opened the puzzle.
 */
export async function adoptRecord(record: DailyRecord, player: string): Promise<void> {
  let ledger = await currentLedger();
  // The close may be the one that created the device's player. The ledger is that player's from here on, so the next
  // sync does not take the record for someone else's and remove the board this device has just finished.
  if (ledger.player !== player) {
    await forget(ledger);
    ledger = { player, results: [], boards: [] };
  }
  knownPlayer = player;
  const local = await loadDailyResult(record.game, record.date, record.variant || undefined);
  await applyRecord(record, { ledger, local, boardsFrom: null, uploads: null });
  await idbSet(STORES.stats, LEDGER_KEY, ledger);
}

/** Keeps a close that could not be sent, for the next sync of the same player. */
export async function queueSubmission(score: ScoreSubmission): Promise<void> {
  // On a page that loaded offline no sync has answered. The ledger still names the player the last one answered for.
  const player = knownPlayer !== undefined ? knownPlayer : (await currentLedger()).player;
  const pending = (await idbGet<Pending[]>(STORES.stats, OUTBOX_KEY)) ?? [];
  const same = (entry: Pending) => entry.player === player && entry.score.game === score.game && (entry.score.variant ?? "") === (score.variant ?? "") && entry.score.date === score.date;
  const queued = pending.findIndex(same);
  if (queued >= 0) {
    // One close per daily. The exception is a reveal: its early report waits here without a board, and the full close
    // that follows it, with the board and the counts, is the one worth sending.
    if (score.board === undefined || pending[queued].score.board !== undefined) return;
    await idbSet(STORES.stats, OUTBOX_KEY, pending.map((entry, index) => (index === queued ? { player, score } : entry)));
    return;
  }
  // A handful at most: one per game and language, for the two days that can still be played.
  await idbSet(STORES.stats, OUTBOX_KEY, [...pending, { player, score }].slice(-32));
}
