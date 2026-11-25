import { describe, expect, it } from "vitest";
import { SEED_CODECS } from "@/games/codecs";
import { GAME_IDS } from "@/games/registry";
import { cleanAvatarSeed, cleanPlayerName, randomAvatarSeed, randomPlayerName } from "@/shared/online/names";
import { HINT_PENALTY_MS, MAX_ROUNDS, isRaceOver, nextRound, normalizeRoomCode, randomRoomCode, rankRoom, roomPath, roundPath, roundSpec, standingOf, validateRounds } from "@/shared/online/rooms";
import { PAR_MS, parseScore, scorePoints } from "@/shared/online/scores";
import type { RoomPlayer, RoundConfig } from "@/shared/online/types";
import { schemaStatements } from "@/server/schema";

const START = Date.parse("2026-11-25T18:00:00Z");
const at = (seconds: number): string => new Date(START + seconds * 1000).toISOString();

/** A player of a room. `results` is a list of [seconds after the start, solved, hints]. */
function player(id: string, overrides: Partial<RoomPlayer> & { rounds?: [number, boolean, number?][] } = {}): RoomPlayer {
  const { rounds = [], ...rest } = overrides;
  return {
    id,
    name: id,
    avatar: "seed",
    joinedAt: at(-60),
    seenAt: at(0),
    startedAt: at(0),
    results: rounds.map(([seconds, solved, hints]) => ({ at: at(seconds), solved, hints: hints ?? 0 })),
    finishedAt: null,
    gaveUp: false,
    ...rest,
  };
}

describe("room codes", () => {
  it("are five characters with no look-alikes", () => {
    for (let index = 0; index < 200; index++) expect(randomRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  });

  it("are read back whatever the case, and anything else is refused", () => {
    expect(normalizeRoomCode(" abcde ")).toBe("ABCDE");
    expect(normalizeRoomCode("ABCD")).toBeNull();
    expect(normalizeRoomCode("ABCDEF")).toBeNull();
    // I, O, 0 and 1 are not in the alphabet.
    expect(normalizeRoomCode("ABC1O")).toBeNull();
    expect(normalizeRoomCode("../..")).toBeNull();
  });
});

describe("the rounds of a room", () => {
  it("accepts one to ten rounds of real games, sizes and languages", () => {
    expect(validateRounds([{ game: "zip", difficulty: "hard", size: 7 }])).toEqual([{ game: "zip", difficulty: "hard", size: 7 }]);
    expect(validateRounds(Array.from({ length: MAX_ROUNDS }, () => ({ game: "queens", difficulty: "easy" })))).toHaveLength(MAX_ROUNDS);
    expect(validateRounds([{ game: "chess", difficulty: "medium", size: null, lang: null }])).toEqual([{ game: "chess", difficulty: "medium" }]);
  });

  it("always names the language of a game made of words", () => {
    expect(validateRounds([{ game: "termo", difficulty: "hard", lang: "en" }])).toEqual([{ game: "termo", difficulty: "hard", lang: "en" }]);
    // Left out, it is the language the game shipped in, so every player gets the same words whatever their own setting.
    expect(validateRounds([{ game: "wend", difficulty: "easy" }])).toEqual([{ game: "wend", difficulty: "easy", lang: "pt-br" }]);
  });

  it("refuses what no game could build", () => {
    expect(validateRounds([])).toBeNull();
    expect(validateRounds(Array.from({ length: MAX_ROUNDS + 1 }, () => ({ game: "zip", difficulty: "easy" })))).toBeNull();
    expect(validateRounds([{ game: "tetris", difficulty: "easy" }])).toBeNull();
    expect(validateRounds([{ game: "zip", difficulty: "impossible" }])).toBeNull();
    expect(validateRounds([{ game: "zip", difficulty: "easy", size: 99 }])).toBeNull();
    // Chess and Termo have one board size.
    expect(validateRounds([{ game: "chess", difficulty: "easy", size: 8 }])).toBeNull();
    expect(validateRounds([{ game: "zip", difficulty: "easy", lang: "en" }])).toBeNull();
    expect(validateRounds([{ game: "termo", difficulty: "easy", lang: "fr" }])).toBeNull();
    expect(validateRounds("zip")).toBeNull();
    expect(validateRounds([null])).toBeNull();
  });

  it("turns a round into the seed every player's game builds from", () => {
    const rounds: RoundConfig[] = [
      { game: "zip", difficulty: "hard", size: 7, token: "rAbc123" },
      { game: "termo", difficulty: "expert", lang: "en", token: "rXyz789" },
      { game: "wend", difficulty: "easy", lang: "pt-br", token: "rQrs456" },
    ];
    expect(roundPath("ABCDE", rounds, 0)).toBe(`/zip/play?seed=${encodeURIComponent(`ZIP:rAbc123:${SEED_CODECS.zip.currentVersion}:hard:7`)}&room=ABCDE&round=1`);
    expect(roundPath("ABCDE", rounds, 1)).toBe(`/termo/play?seed=${encodeURIComponent("TERMO:rXyz789:1:expert:en")}&room=ABCDE&round=2`);
    // The legacy language is left out of the seed, as everywhere else.
    expect(roundPath("ABCDE", rounds, 2)).toContain(encodeURIComponent("WEND:rQrs456:1:easy"));
    expect(roundSpec(rounds[1])).toEqual({ token: "rXyz789", version: 1, difficulty: "expert", lang: "en" });
    expect(roomPath("ABCDE")).toBe("/rooms/ABCDE");
  });

  it("has a seed format for every game", () => {
    for (const game of GAME_IDS) expect(SEED_CODECS[game].prefix).toBe(game.toUpperCase());
  });
});

describe("a player's standing", () => {
  it("counts the clock from the first board to the last round, plus the hints", () => {
    const racing = standingOf(player("ana", { rounds: [[40, true, 1]] }), 3, at(100));
    expect(racing).toMatchObject({ state: "racing", played: 1, solved: 1, hints: 1, penaltyMs: HINT_PENALTY_MS, timeMs: 100_000 + HINT_PENALTY_MS, splitsMs: [40_000] });

    const done = standingOf(player("bia", { rounds: [[40, true], [95, true, 2]], finishedAt: at(95) }), 2, at(500));
    // Finished: the clock stopped at the last round, however long ago that was.
    expect(done).toMatchObject({ state: "finished", solved: 2, timeMs: 95_000 + 2 * HINT_PENALTY_MS, splitsMs: [40_000, 55_000] });
  });

  it("knows who has not started, who gave up and who went away", () => {
    expect(standingOf(player("ana", { startedAt: null }), 2, at(30))).toMatchObject({ state: "waiting", timeMs: null });
    // A player who gave up keeps the time of their last round.
    expect(standingOf(player("bia", { rounds: [[50, true]], gaveUp: true }), 3, at(900))).toMatchObject({ state: "gave-up", solved: 1, timeMs: 50_000 });
    expect(standingOf(player("cai", { seenAt: at(0) }), 2, at(46)).away).toBe(true);
    expect(standingOf(player("cai", { seenAt: at(10) }), 2, at(46)).away).toBe(false);
  });

  it("says which round comes next", () => {
    expect(nextRound(player("ana"), 3)).toBe(0);
    expect(nextRound(player("ana", { rounds: [[10, true], [20, false]] }), 3)).toBe(2);
    expect(nextRound(player("ana", { rounds: [[10, true]], finishedAt: at(10) }), 1)).toBeNull();
    expect(nextRound(player("ana", { gaveUp: true }), 3)).toBeNull();
  });
});

describe("the table of a race", () => {
  const order = (players: RoomPlayer[], total: number, now: string): string[] => rankRoom(players, total, now).map((standing) => standing.player.id);

  it("puts more rounds solved first, then the lower time", () => {
    const slowButSolved = player("slow", { rounds: [[200, true], [400, true]], finishedAt: at(400) });
    const fastButRevealed = player("fast", { rounds: [[5, false], [10, false]], finishedAt: at(10) });
    const middle = player("middle", { rounds: [[60, true], [90, false]], finishedAt: at(90) });
    // Revealing every board is the fastest way to the end, and it never beats solving.
    expect(order([fastButRevealed, middle, slowButSolved], 2, at(500))).toEqual(["slow", "middle", "fast"]);

    const quick = player("quick", { rounds: [[30, true], [70, true]], finishedAt: at(70) });
    expect(order([slowButSolved, quick], 2, at(500))).toEqual(["quick", "slow"]);
  });

  it("counts hints into the time that decides between equals", () => {
    const hinted = player("hinted", { rounds: [[50, true, 2]], finishedAt: at(50) });
    const clean = player("clean", { rounds: [[90, true]], finishedAt: at(90) });
    // 50 s plus two hints is 110 s, behind a clean 90 s.
    expect(order([hinted, clean], 1, at(100))).toEqual(["clean", "hinted"]);
  });

  it("keeps a finished player ahead of one still racing with the same rounds solved, and those who gave up last among equals", () => {
    const done = player("done", { rounds: [[60, true], [120, false]], finishedAt: at(120) });
    const racing = player("racing", { rounds: [[30, true]] });
    const quit = player("quit", { rounds: [[20, true]], gaveUp: true });
    const idle = player("idle", { startedAt: null });
    expect(order([idle, quit, racing, done], 2, at(130))).toEqual(["done", "racing", "quit", "idle"]);
  });

  it("is over once nobody is left racing", () => {
    const done = player("done", { rounds: [[60, true]], finishedAt: at(60), seenAt: at(60) });
    const racing = player("racing", { seenAt: at(100) });
    expect(isRaceOver([done, racing], 1, at(110))).toBe(false);
    expect(isRaceOver([done, { ...racing, gaveUp: true }], 1, at(110))).toBe(true);
    // A player who closed the page does not hold the others forever.
    expect(isRaceOver([done, racing], 1, at(200))).toBe(true);
    expect(isRaceOver([], 1, at(0))).toBe(false);
  });
});

describe("points for a daily puzzle", () => {
  it("gives 100 for solving, minus 10 per hint, plus up to 50 for speed", () => {
    expect(scorePoints("medium", PAR_MS.medium, 0)).toBe(150);
    expect(scorePoints("medium", 30_000, 0)).toBe(150);
    // Twice the par time earns half the speed bonus.
    expect(scorePoints("medium", PAR_MS.medium * 2, 0)).toBe(125);
    expect(scorePoints("easy", PAR_MS.easy, 3)).toBe(120);
    // Many hints still leave something for having finished.
    expect(scorePoints("expert", 3_600_000, 40)).toBe(20 + 5);
  });

  it("accepts a well-formed result and refuses the rest", () => {
    const score = { game: "zip", date: "2026-11-25", number: 618, difficulty: "medium", size: 6, elapsedMs: 95_000, hintsUsed: 1, mistakes: 2 };
    expect(parseScore(score)).toEqual(score);
    expect(parseScore({ ...score, variant: "en" })).toEqual({ ...score, variant: "en" });
    for (const broken of [{ game: "tetris" }, { date: "25/11/2026" }, { date: "2026-13-40" }, { difficulty: "brutal" }, { elapsedMs: 200 }, { elapsedMs: 90_000_000 }, { elapsedMs: 1500.5 }, { hintsUsed: -1 }, { mistakes: "2" }, { variant: "EN; drop" }]) {
      expect(parseScore({ ...score, ...broken }), JSON.stringify(broken)).toBeNull();
    }
  });
});

describe("player names and avatars", () => {
  it("suggests a name in the page's language", () => {
    expect(randomPlayerName("en", () => 0)).toBe("Fox 100");
    expect(randomPlayerName("pt-br", () => 0)).toBe("Raposa 100");
    expect(randomPlayerName("xx", () => 0.999)).toBe("Finch 999");
  });

  it("stores a name as one clean, bounded line", () => {
    expect(cleanPlayerName("  Ana   Banana ")).toBe("Ana Banana");
    expect(cleanPlayerName("João Açaí")).toBe("João Açaí");
    // Characters that hide or reorder text in someone else's table are dropped.
    expect(cleanPlayerName("A​n‮a\n")).toBe("Ana");
    expect([...(cleanPlayerName("x".repeat(80)) ?? "")]).toHaveLength(20);
    expect(cleanPlayerName("   ​ ")).toBeNull();
    expect(cleanPlayerName(42)).toBeNull();
  });

  it("accepts only a plain avatar seed", () => {
    expect(cleanAvatarSeed(randomAvatarSeed())).not.toBeNull();
    expect(cleanAvatarSeed("abc")).toBeNull();
    expect(cleanAvatarSeed("<svg onload=alert(1)>")).toBeNull();
    expect(cleanAvatarSeed(null)).toBeNull();
  });
});

describe("the database schema", () => {
  it("is a list of statements that can run again, in a schema with a safe name", () => {
    const statements = schemaStatements("play_e2e");
    expect(statements[0]).toBe('create schema if not exists "play_e2e"');
    for (const statement of statements) expect(statement).toMatch(/if not exists/);
    expect(() => schemaStatements('play"; drop schema public; --')).toThrow();
  });
});
