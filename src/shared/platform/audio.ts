/**
 * Short synthesized tones through Web Audio. No audio files, so nothing extra
 * to cache for offline play. The context is created lazily on the first sound,
 * which always follows a user gesture, so autoplay policies are satisfied.
 */
export type SoundName =
  | "place"
  | "remove"
  | "invalid"
  | "hint"
  | "complete"
  /** Zip: the path grew by one cell. Pitch rises with progress. */
  | "step"
  /** Zip: the path reached the next number. */
  | "checkpoint"
  /** Zip: the path got shorter. */
  | "back"
  /** A solution is being revealed, one piece at a time. */
  | "reveal";

type Tone = { frequency: number; startMs: number; durationMs: number };
type Sound = { wave: OscillatorType; gain: number; tones: Tone[] };

const SOUNDS: Record<SoundName, Sound> = {
  place: { wave: "sine", gain: 0.08, tones: [{ frequency: 660, startMs: 0, durationMs: 70 }] },
  remove: { wave: "sine", gain: 0.06, tones: [{ frequency: 330, startMs: 0, durationMs: 70 }] },
  invalid: { wave: "triangle", gain: 0.1, tones: [{ frequency: 196, startMs: 0, durationMs: 90 }, { frequency: 147, startMs: 80, durationMs: 120 }] },
  hint: { wave: "sine", gain: 0.06, tones: [{ frequency: 880, startMs: 0, durationMs: 90 }] },
  complete: {
    wave: "sine",
    gain: 0.09,
    tones: [
      { frequency: 523.25, startMs: 0, durationMs: 110 },
      { frequency: 659.25, startMs: 110, durationMs: 110 },
      { frequency: 783.99, startMs: 220, durationMs: 110 },
      { frequency: 1046.5, startMs: 330, durationMs: 220 },
    ],
  },
  step: { wave: "sine", gain: 0.05, tones: [{ frequency: 440, startMs: 0, durationMs: 45 }] },
  checkpoint: { wave: "sine", gain: 0.08, tones: [{ frequency: 660, startMs: 0, durationMs: 60 }, { frequency: 990, startMs: 55, durationMs: 110 }] },
  back: { wave: "sine", gain: 0.055, tones: [{ frequency: 294, startMs: 0, durationMs: 45 }] },
  reveal: { wave: "sine", gain: 0.05, tones: [{ frequency: 587, startMs: 0, durationMs: 60 }] },
};

const FADE_SECONDS = 0.012;

/**
 * Overall loudness. The per-sound gains above only set how the sounds relate to
 * each other, and this is the one number to change to make everything louder or
 * quieter. At 3.5 the tones peak between 0.19 and 0.35 of full scale, up from
 * 0.04 to 0.09, which was too faint on laptop and phone speakers.
 */
export const MASTER_VOLUME = 3.5;

let context: AudioContext | null = null;
let output: AudioNode | null = null;

/**
 * Everything plays through one master gain and a limiter. A fast Zip drag fires
 * a tone per cell and they overlap, and at this volume a few stacked tones could
 * clip. The limiter holds the sum just under full scale instead.
 */
function getOutput(ctx: AudioContext): AudioNode {
  if (output) return output;
  const master = ctx.createGain();
  master.gain.value = MASTER_VOLUME;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 4;
  limiter.ratio.value = 16;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.08;
  master.connect(limiter).connect(ctx.destination);
  output = master;
  return output;
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

/**
 * `pitch` multiplies every frequency. Zip passes 1 to 2 as the path fills the
 * board, so a good run climbs an octave.
 */
export function playSound(name: SoundName, enabled: boolean, pitch = 1): void {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);

  const sound = SOUNDS[name];
  const destination = getOutput(ctx);
  for (const tone of sound.tones) {
    const start = ctx.currentTime + tone.startMs / 1000;
    const end = start + tone.durationMs / 1000;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = sound.wave;
    oscillator.frequency.setValueAtTime(tone.frequency * pitch, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(sound.gain, start + FADE_SECONDS);
    gain.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(end + FADE_SECONDS);
  }
}
