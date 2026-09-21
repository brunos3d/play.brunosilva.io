import { expect, test } from "@playwright/test";
import { MASTER_VOLUME } from "@/shared/platform/audio";
import { SETTINGS_KEY } from "../shared";
import { draw, openPuzzle, practicePuzzle } from "../patches/helpers";
import { drawCells, openZip, tapCell, zipPuzzle } from "../zip/helpers";

type Probe = { tones: number; peaks: number[]; masters: number[]; limiters: number; frequencies: number[] };

/**
 * Nobody can listen in a headless run, so this test measures instead. It wraps
 * the Web Audio calls the game makes and records every tone: its frequency, the
 * peak its envelope ramps to, and what it is routed through.
 */
async function installProbe(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(([key]) => {
    localStorage.setItem(key, JSON.stringify({ sound: true, haptics: false, tutorials: { zip: true, patches: true } }));
    const probe = { tones: 0, peaks: [] as number[], masters: [] as number[], limiters: 0, frequencies: [] as number[] };
    (window as unknown as { __audio: typeof probe }).__audio = probe;

    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const node = createGain.call(this);
      const ramp = node.gain.linearRampToValueAtTime.bind(node.gain);
      node.gain.linearRampToValueAtTime = (value: number, time: number) => {
        if (value > 0) probe.peaks.push(value);
        return ramp(value, time);
      };
      gainParams.add(node.gain);
      return node;
    };
    // The master gain is the only gain whose value is assigned directly. Tone envelopes are scheduled
    // with ramps, and reading `value` back would return whatever point the ramp has reached.
    const gainParams = new WeakSet<AudioParam>();
    const valueProperty = Object.getOwnPropertyDescriptor(AudioParam.prototype, "value")!;
    Object.defineProperty(AudioParam.prototype, "value", {
      ...valueProperty,
      set(this: AudioParam, next: number) {
        if (gainParams.has(this)) probe.masters.push(next);
        valueProperty.set!.call(this, next);
      },
    });
    const createCompressor = AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor = function () {
      probe.limiters++;
      return createCompressor.call(this);
    };
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const node = createOscillator.call(this);
      probe.tones++;
      const set = node.frequency.setValueAtTime.bind(node.frequency);
      node.frequency.setValueAtTime = (value: number, time: number) => {
        probe.frequencies.push(Math.round(value));
        return set(value, time);
      };
      return node;
    };
  }, [SETTINGS_KEY]);
}

const readProbe = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __audio: Probe }).__audio);

test("Zip plays a tone per step that rises in pitch, buzzes on a refused step, and is loud enough", async ({ page }) => {
  await installProbe(page);
  const { puzzle, url } = zipPuzzle("e2e-sound", "easy", 5);
  await openZip(page, url);
  expect((await readProbe(page)).tones).toBe(0);

  await drawCells(page, 5, puzzle.solution.slice(0, 7));
  const afterDrag = await readProbe(page);
  expect(afterDrag.tones).toBeGreaterThanOrEqual(7);
  // Plain steps climb: the last step tone is higher than the first.
  const steps = afterDrag.frequencies.filter((frequency) => frequency >= 440 && frequency < 660);
  expect(steps.at(-1)!).toBeGreaterThan(steps[0]);

  // A refused step: tap a far-away empty cell. The buzz is the low triangle pair.
  const far = puzzle.solution[puzzle.solution.length - 2];
  await tapCell(page, 5, far);
  const afterRefusal = await readProbe(page);
  expect(afterRefusal.frequencies).toEqual(expect.arrayContaining([196, 147]));

  // Loudness: one master gain at MASTER_VOLUME through one limiter, and audible tone peaks.
  expect(afterRefusal.masters).toEqual([MASTER_VOLUME]);
  expect(afterRefusal.limiters).toBe(1);
  const loudest = Math.max(...afterRefusal.peaks) * MASTER_VOLUME;
  const quietest = Math.min(...afterRefusal.peaks) * MASTER_VOLUME;
  expect(quietest).toBeGreaterThanOrEqual(0.15);
  expect(loudest).toBeLessThanOrEqual(0.5);
});

test("Patches plays on placing, on a refused patch and on a hint, through the same master volume", async ({ page }) => {
  await installProbe(page);
  const { targets, url } = practicePuzzle("e2e-sound", "easy", 5);
  await openPuzzle(page, url);

  await draw(page, 5, targets[0]);
  expect((await readProbe(page)).frequencies).toContain(660);

  await draw(page, 5, { clue: targets[1].clue, rect: { row: 0, column: 0, width: 5, height: 5 } });
  expect((await readProbe(page)).frequencies).toEqual(expect.arrayContaining([196, 147]));

  await page.getByRole("button", { name: /^Hint/ }).click();
  const probe = await readProbe(page);
  expect(probe.frequencies).toContain(880);
  expect(probe.masters).toEqual([MASTER_VOLUME]);
  expect(probe.limiters).toBe(1);
});

test("turning sound off in the settings silences the game", async ({ page }) => {
  await installProbe(page);
  const { puzzle, url } = zipPuzzle("e2e-sound", "easy", 5);
  await openZip(page, url);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("game-settings").getByRole("switch", { name: "Sound" }).click();
  await page.getByTestId("game-settings").getByRole("button", { name: "Close" }).click();
  await drawCells(page, 5, puzzle.solution.slice(0, 6));
  expect((await readProbe(page)).tones).toBe(0);
});
