"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useHydrated } from "@/shared/hooks/use-settings";
import { ShuffleIcon } from "@/shared/ui/icons";
import { online } from "./api";
import { NAME_MAX_LENGTH, cleanPlayerName, randomAvatarSeed } from "./names";
import { PlayerAvatar } from "./player-avatar";
import type { Me } from "./types";
import { rememberPlayer, usePlayer } from "./use-player";

export type ProfileDraft = {
  /** What the form shows: the player's own name and avatar, with any edits on top. Null until the device's player is known. */
  value: { name: string; avatar: string } | null;
  setName: (name: string) => void;
  shuffleAvatar: () => void;
  /** True when the name on screen can be saved. */
  valid: boolean;
  /** True when the form differs from what the server has. */
  dirty: boolean;
  /** Makes the form real: creates the player with it, or saves the edits. Resolves with the player. */
  commit: () => Promise<Me>;
};

/**
 * A name and an avatar the player can change before they exist on the server.
 * A device without a player sees a suggestion, generated in the page's
 * language, and nothing is stored until `commit`.
 */
export function useProfileDraft(): ProfileDraft {
  const locale = useLocale();
  const hydrated = useHydrated();
  const { me, suggestion, update } = usePlayer();
  const [edits, setEdits] = useState<{ name?: string; avatar?: string }>({});
  // Random, so it is made on the device only, after hydration, and kept for as long as the page lives.
  const fallback = useMemo(() => (hydrated ? suggestion() : null), [hydrated, suggestion]);

  const base = me ? { name: me.name, avatar: me.avatar } : me === null && fallback ? { name: fallback.name, avatar: fallback.avatar } : null;
  const name = base ? (edits.name ?? base.name) : null;
  const avatar = base ? (edits.avatar ?? base.avatar) : null;
  const value = useMemo(() => (name !== null && avatar !== null ? { name, avatar } : null), [avatar, name]);
  const dirty = Boolean(me && value && (value.name !== me.name || value.avatar !== me.avatar));
  const valid = value !== null && cleanPlayerName(value.name) !== null;

  const commit = useCallback(async () => {
    if (!value) throw new Error("The profile is not loaded yet.");
    if (!me) {
      const created = await online.ensureMe({ name: value.name, avatar: value.avatar, locale });
      rememberPlayer(created);
      setEdits({});
      return created;
    }
    if (!dirty) return me;
    const saved = await update({ name: value.name, avatar: value.avatar });
    setEdits({});
    return saved;
  }, [dirty, locale, me, update, value]);

  return {
    value,
    setName: (name) => setEdits((current) => ({ ...current, name })),
    shuffleAvatar: () => setEdits((current) => ({ ...current, avatar: randomAvatarSeed() })),
    valid,
    dirty,
    commit,
  };
}

/** The form itself: avatar, a button for another one, and the name. Saving is the caller's, through `draft.commit`. */
export function ProfileFields({ draft, disabled }: { draft: ProfileDraft; disabled?: boolean }) {
  const t = useTranslations("online.profile");
  if (!draft.value) return <div className="h-[52px]" aria-hidden="true" />;
  return (
    <div className="flex items-center gap-3" data-testid="profile-fields">
      <button type="button" className="relative flex-none rounded-full" onClick={draft.shuffleAvatar} disabled={disabled} aria-label={t("newAvatar")} title={t("newAvatar")} data-testid="profile-avatar">
        <PlayerAvatar seed={draft.value.avatar} size={52} />
        <span className="absolute -right-1 -bottom-1 grid place-items-center w-6 h-6 rounded-full bg-[var(--surface)] shadow-[0_0_0_1.5px_var(--thread)] text-[var(--ink-soft)]">
          <ShuffleIcon className="w-3.5 h-3.5" />
        </span>
      </button>
      <label className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">{t("label")}</span>
        <input
          className="mg-field"
          value={draft.value.name}
          onChange={(event) => draft.setName(event.target.value)}
          placeholder={t("placeholder")}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="nickname"
          autoCapitalize="words"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={!draft.valid}
          data-testid="profile-name"
        />
      </label>
    </div>
  );
}

/** The profile with its own Save button, for pages where changing it is the whole point. */
export function ProfileEditor() {
  const t = useTranslations("online.profile");
  const draft = useProfileDraft();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const save = async () => {
    setState("saving");
    try {
      await draft.commit();
      setState("saved");
    } catch {
      setState("idle");
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <ProfileFields draft={draft} disabled={state === "saving"} />
      {!draft.valid && draft.value && <p className="text-sm text-[var(--invalid)]">{t("invalid")}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--ink-faint)] leading-relaxed">{t("note")}</p>
        {(draft.dirty || state === "saved") && (
          <button type="button" className="mg-button flex-none" data-variant={draft.dirty ? "primary" : undefined} onClick={save} disabled={!draft.dirty || !draft.valid || state === "saving"} data-testid="profile-save">
            {draft.dirty ? t("save") : t("saved")}
          </button>
        )}
      </div>
    </div>
  );
}
