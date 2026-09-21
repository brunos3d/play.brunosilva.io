"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { GameMeta } from "@/games/registry";
import { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";
import type { SeedCodec } from "@/shared/engine/seed-codec";
import { buildPlayPath } from "@/shared/platform/share-text";
import { GameFooter } from "./game-footer";
import { GameHeader } from "./game-header";
import { ShuffleIcon } from "./icons";
import { randomSeedToken } from "./random-seed";

type Props = { game: GameMeta; codec: SeedCodec; blurb: string };

/** Pickers for difficulty, board size and seed. The same screen serves every game. */
export function PracticeSetup({ game, codec, blurb }: Props) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [size, setSize] = useState<number | null>(null);
  const [seed, setSeed] = useState("");
  const sizes: (number | null)[] = [null, ...Array.from({ length: codec.maxSize - codec.minSize + 1 }, (_, index) => codec.minSize + index)];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // A pasted canonical seed wins over the pickers, so shared seeds reproduce exactly.
    const token = seed.trim() === "" ? randomSeedToken() : seed;
    router.push(buildPlayPath(game.path, codec, codec.resolve({ seed: token, difficulty, size, version: codec.currentVersion })));
  };

  return (
    <main className="mg-shell">
      <GameHeader game={game} mode="practice" />

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 mt-2">
        <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">{blurb}</p>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)] mb-2">Difficulty</legend>
          <div className="mg-segment">
            {DIFFICULTIES.map((option) => (
              <button key={option} type="button" aria-pressed={difficulty === option} className="capitalize" onClick={() => setDifficulty(option)}>
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)] mb-2">Board size</legend>
          <div className="mg-segment">
            {sizes.map((option) => (
              <button key={option ?? "auto"} type="button" aria-pressed={size === option} aria-label={option === null ? "Automatic size" : `${option} by ${option}`} onClick={() => setSize(option)}>
                {option ?? "Auto"}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">Seed (optional)</span>
          <input
            className="mg-field"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder={`A word, a number, or a shared ${codec.prefix}:… seed`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={96}
            data-testid="game-seed-input"
          />
          <span className="text-xs text-[var(--ink-faint)]">The same seed, difficulty and size always build the same puzzle.</span>
        </label>

        <button type="submit" className="mg-button" data-variant="primary" data-testid="game-start">
          <ShuffleIcon /> {seed.trim() === "" ? "Random puzzle" : "Play this seed"}
        </button>
      </form>

      <GameFooter current={game.id} />
    </main>
  );
}
