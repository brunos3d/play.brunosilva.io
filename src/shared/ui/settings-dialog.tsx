"use client";

import { supportsHaptics } from "@/shared/platform/haptics";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "./dialog";

type Props = {
  open: boolean;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onReplayTutorial: () => void;
  onClose: () => void;
};

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-sm text-[var(--ink-soft)]">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="mg-switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

/** Settings are shared by every game on the platform. */
export function SettingsDialog({ open, settings, onChange, onReplayTutorial, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Settings" testId="game-settings">
      <div className="divide-y divide-[var(--thread)]">
        <Toggle label="Sound" hint="Short tones for moves, mistakes and solving." checked={settings.sound} onChange={(sound) => onChange({ sound })} />
        <Toggle
          label="Vibration"
          hint={supportsHaptics() ? "Light taps on supported phones." : "This device does not support vibration."}
          checked={settings.haptics}
          onChange={(haptics) => onChange({ haptics })}
        />
      </div>
      <button type="button" className="mg-button w-full mt-4" onClick={onReplayTutorial}>
        Replay the tutorial
      </button>
      <p className="mt-4 text-xs text-[var(--ink-faint)] leading-relaxed">
        These settings apply to every game. Progress, streaks and best times are stored on this device only. Animations follow your system&apos;s reduced motion setting.
      </p>
    </Dialog>
  );
}
