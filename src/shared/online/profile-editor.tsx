"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useHydrated } from "@/shared/hooks/use-settings";
import { ShuffleIcon } from "@/shared/ui/icons";
import { OnlineError, online } from "./api";
import { NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH, cleanNickname, cleanPlayerName, nicknameFromName, randomAvatarSeed } from "./names";
import { PlayerAvatar } from "./player-avatar";
import type { Me } from "./types";
import { rememberPlayer, usePlayer } from "./use-player";

type Profile = { name: string; nickname: string; avatar: string };

export type ProfileDraft = {
  /** What the form shows: the player's own profile, with any edits on top. Null until the device's player is known. */
  value: Profile | null;
  setName: (name: string) => void;
  setNickname: (nickname: string) => void;
  shuffleAvatar: () => void;
  /** True when the name on screen can be saved. */
  valid: boolean;
  /** True when the nickname on screen is one a player may have. Whether it is free is the server's to say. */
  nicknameValid: boolean;
  /** True when the form differs from what the server has. For a device with no player yet, when anything was typed. */
  dirty: boolean;
  /** Makes the form real: creates the player with it, or saves the edits. Resolves with the player. Rejects with an OnlineError: "nickname-taken" when someone else has the nickname. */
  commit: () => Promise<Me>;
};

/**
 * A profile the player can change before they exist on the server. A device
 * without a player sees a suggestion, generated in the page's language, and
 * nothing is stored until `commit`.
 */
export function useProfileDraft(): ProfileDraft {
  const locale = useLocale();
  const hydrated = useHydrated();
  const { me, suggestion, update } = usePlayer();
  const [edits, setEdits] = useState<Partial<Profile>>({});
  // Random, so it is made on the device only, after hydration, and kept for as long as the page lives.
  const fallback = useMemo(() => (hydrated ? suggestion() : null), [hydrated, suggestion]);

  const base = me ? { name: me.name, nickname: me.nickname, avatar: me.avatar } : me === null && fallback ? { name: fallback.name, nickname: "", avatar: fallback.avatar } : null;
  const name = base ? (edits.name ?? base.name) : null;
  const avatar = base ? (edits.avatar ?? base.avatar) : null;
  // A player that does not exist yet has no nickname. The form shows the one the server would make from the name, until the player types their own.
  const nickname = base && name !== null ? (edits.nickname ?? (base.nickname || nicknameFromName(name))) : null;
  const value = useMemo(() => (name !== null && avatar !== null && nickname !== null ? { name, nickname, avatar } : null), [avatar, name, nickname]);
  const changed = Boolean(me && value && (value.name !== me.name || value.avatar !== me.avatar || value.nickname !== me.nickname));
  const dirty = me ? changed : Object.keys(edits).length > 0;
  const valid = value !== null && cleanPlayerName(value.name) !== null;
  const nicknameValid = value !== null && cleanNickname(value.nickname) !== null;

  const commit = useCallback(async () => {
    if (!value) throw new Error("The profile is not loaded yet.");
    if (!me) {
      let created = await online.ensureMe({ name: value.name, avatar: value.avatar, locale });
      rememberPlayer(created);
      // The server made a nickname from the name. One the player typed replaces it.
      if (edits.nickname !== undefined && cleanNickname(edits.nickname) !== created.nickname) created = await update({ nickname: edits.nickname });
      setEdits({});
      return created;
    }
    if (!changed) return me;
    const saved = await update({ name: value.name, avatar: value.avatar, nickname: value.nickname });
    setEdits({});
    return saved;
  }, [changed, edits.nickname, locale, me, update, value]);

  return {
    value,
    setName: (next) => setEdits((current) => ({ ...current, name: next })),
    // Typed as it will be stored: lower case, and without the "@" people put in front of it.
    setNickname: (next) => setEdits((current) => ({ ...current, nickname: next.replace(/^@+/, "").toLowerCase() })),
    shuffleAvatar: () => setEdits((current) => ({ ...current, avatar: randomAvatarSeed() })),
    valid,
    nicknameValid,
    dirty,
    commit,
  };
}

const LABEL = "text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]";

/**
 * The form itself: avatar, a button for another one, and the display name.
 * With `nickname` it also asks for the nickname, which is where a player
 * manages their profile. Joining a room only needs a name. Saving is the
 * caller's, through `draft.commit`.
 */
export function ProfileFields({ draft, disabled, nickname = false }: { draft: ProfileDraft; disabled?: boolean; nickname?: boolean }) {
  const t = useTranslations("online.profile");
  if (!draft.value) return <div className={nickname ? "h-[150px]" : "h-[70px]"} aria-hidden="true" />;
  return (
    <div className="flex flex-col gap-3" data-testid="profile-fields">
      <div className="flex items-center gap-3">
        <button type="button" className="relative flex-none rounded-full" onClick={draft.shuffleAvatar} disabled={disabled} aria-label={t("newAvatar")} title={t("newAvatar")} data-testid="profile-avatar">
          <PlayerAvatar seed={draft.value.avatar} size={52} />
          <span className="absolute -right-1 -bottom-1 grid place-items-center w-6 h-6 rounded-full bg-[var(--surface)] shadow-[0_0_0_1.5px_var(--thread)] text-[var(--ink-soft)]">
            <ShuffleIcon className="w-3.5 h-3.5" />
          </span>
        </button>
        <label className="flex-1 min-w-0 flex flex-col gap-1">
          <span className={LABEL}>{t("label")}</span>
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
      {nickname && (
        <label className="flex flex-col gap-1">
          <span className={LABEL}>{t("nickname")}</span>
          <span className="mg-field-prefixed">
            <span aria-hidden="true">@</span>
            <input
              className="mg-field"
              value={draft.value.nickname}
              onChange={(event) => draft.setNickname(event.target.value)}
              maxLength={NICKNAME_MAX_LENGTH}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={disabled}
              aria-invalid={!draft.nicknameValid}
              aria-describedby="profile-nickname-hint"
              data-testid="profile-nickname"
            />
          </span>
          <span id="profile-nickname-hint" className="text-xs text-[var(--ink-faint)] leading-relaxed">
            {t("nicknameHint")}
          </span>
        </label>
      )}
    </div>
  );
}

/** The profile with its own Save button: display name, nickname and avatar. The draft is the caller's, so the page around the form can read what it shows. `onSaved` hears about a save that went through. */
export function ProfileEditor({ draft, onSaved }: { draft: ProfileDraft; onSaved?: (me: Me) => void }) {
  const t = useTranslations("online.profile");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [problem, setProblem] = useState<"nicknameTaken" | "nicknameInvalid" | "saveFailed" | null>(null);
  const save = async () => {
    setState("saving");
    setProblem(null);
    try {
      onSaved?.(await draft.commit());
      setState("saved");
    } catch (error) {
      const code = error instanceof OnlineError ? error.code : "";
      setProblem(code === "nickname-taken" ? "nicknameTaken" : code === "invalid-nickname" ? "nicknameInvalid" : "saveFailed");
      setState("idle");
    }
  };
  const canSave = draft.dirty && draft.valid && draft.nicknameValid && state !== "saving";
  const message = !draft.value ? null : !draft.valid ? t("invalid") : !draft.nicknameValid ? t("nicknameInvalid") : problem ? t(problem) : null;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) void save();
      }}
    >
      <ProfileFields draft={draft} disabled={state === "saving"} nickname />
      {message && (
        <p className="text-sm font-semibold text-[var(--invalid)]" role="alert" data-testid="profile-error">
          {message}
        </p>
      )}
      {(draft.dirty || state === "saved") && (
        <button type="submit" className="mg-button" data-variant={draft.dirty ? "primary" : undefined} disabled={!canSave} data-testid="profile-save">
          {draft.dirty ? t("save") : t("saved")}
        </button>
      )}
    </form>
  );
}
