"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { LOCALE_META, type Locale } from "@/i18n/config";
import { useHydrated } from "@/shared/hooks/use-settings";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { CheckIcon, CloseIcon, FlameIcon, KeyIcon, SignOutIcon } from "@/shared/ui/icons";
import { PageHeader } from "@/shared/ui/page-header";
import { SiteFooter } from "@/shared/ui/site-footer";
import { OnlineError, online } from "./api";
import { syncDaily } from "./daily-sync";
import { PasskeyFailure, type PasskeyProblem, createPasskey, passkeysSupported, signInWithPasskey } from "./passkeys";
import { PlayerAvatar } from "./player-avatar";
import { ProfileEditor, useProfileDraft } from "./profile-editor";
import type { Account, PasskeyInfo } from "./types";
import { OnlineUnavailable } from "./unavailable";
import { refreshPlayer, rememberPlayer, usePlayer } from "./use-player";

export const ACCOUNT_QUERY = ["account"] as const;

type Busy = "create" | "signIn" | "signOut" | "merge" | "remove" | "delete" | null;
type Notice = { kind: "problem"; problem: PasskeyProblem } | { kind: "done"; message: "created" | "added" | "signedIn" | "merged" | "removed" } | null;

const CARD_TITLE = "mg-display text-[20px] font-semibold leading-tight";
const BODY = "text-sm text-[var(--ink-soft)] leading-relaxed";

/** One passkey of the account: where it was made, when, and the way to remove it. */
function PasskeyRow({ passkey, removable, disabled, onRemove }: { passkey: PasskeyInfo; removable: boolean; disabled: boolean; onRemove: () => void }) {
  const t = useTranslations("online.account");
  const locale = useLocale() as Locale;
  const day = (iso: string): string => new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, { dateStyle: "medium" }).format(new Date(iso));
  const label = passkey.label || t("passkeyUnnamed");
  return (
    <li className="mg-row" data-testid="passkey">
      <KeyIcon className="w-5 h-5 flex-none text-[var(--ink-soft)]" />
      <div className="min-w-0 flex-1">
        <div className="mg-player-line">
          <span className="mg-player-name">{label}</span>
          <span className="mg-tag">{t(passkey.synced ? "synced" : "singleDevice")}</span>
        </div>
        <div className="flex flex-wrap gap-x-2.5 text-xs text-[var(--ink-soft)] whitespace-nowrap">
          <span>{t("passkeyCreated", { date: day(passkey.createdAt) })}</span>
          {passkey.lastUsedAt && <span>{t("passkeyUsed", { date: day(passkey.lastUsedAt) })}</span>}
        </div>
      </div>
      {removable && (
        <button type="button" className="mg-icon-button flex-none" onClick={onRemove} disabled={disabled} aria-label={t("remove", { label })} data-testid="passkey-remove">
          <CloseIcon />
        </button>
      )}
    </li>
  );
}

/**
 * The page where a player manages who they are: display name, nickname and
 * avatar, and how the player is reached. A player starts tied to one device.
 * A passkey turns it into an account that any device can sign in to, and
 * the same page then lists the passkeys, offers to bring in the scores a
 * device had before the sign-in, and signs out.
 */
export function ProfileScreen() {
  const t = useTranslations("online");
  const hydrated = useHydrated();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const { me, unavailable } = usePlayer();
  const draft = useProfileDraft();
  const account = useQuery({ queryKey: ACCOUNT_QUERY, queryFn: online.account });
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [removing, setRemoving] = useState<PasskeyInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (unavailable || (account.error instanceof OnlineError && account.error.code === "unavailable")) return <OnlineUnavailable title={t("profile.title")} />;

  /** Puts a new answer from the server everywhere it is shown: this page, the player store, and the rankings, where a name or the points may have changed. */
  const apply = (next: Account) => {
    queryClient.setQueryData(ACCOUNT_QUERY, next);
    if (next.player) rememberPlayer(next.player);
    else refreshPlayer();
    void queryClient.invalidateQueries({ queryKey: ["ranking"] });
    // Who the player is may have changed, and with it which dailies are closed on this device.
    void syncDaily(true);
  };

  const run = async (what: Exclude<Busy, null>, work: () => Promise<Notice>) => {
    setBusy(what);
    setNotice(null);
    try {
      setNotice(await work());
    } catch (error) {
      setNotice({ kind: "problem", problem: error instanceof PasskeyFailure ? error.problem : error instanceof OnlineError && error.code === "offline" ? "offline" : "failed" });
    } finally {
      setBusy(null);
    }
  };

  const data = account.data;
  const player = data?.player ?? null;
  const isAccount = Boolean(player?.account);
  const supported = hydrated && passkeysSupported();

  const create = () =>
    run("create", async () => {
      // A visitor with no player yet becomes the one the form shows, not another random one.
      apply(await createPasskey(player || !draft.value ? {} : { name: draft.value.name, avatar: draft.value.avatar, locale }));
      return { kind: "done", message: isAccount ? "added" : "created" };
    });
  const signIn = () =>
    run("signIn", async () => {
      apply(await signInWithPasskey());
      return { kind: "done", message: "signedIn" };
    });
  const signOut = () =>
    run("signOut", async () => {
      await online.signOut();
      refreshPlayer();
      await queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY });
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void syncDaily(true);
      return null;
    });
  const merge = () =>
    run("merge", async () => {
      apply(await online.mergeDevice());
      return { kind: "done", message: "merged" };
    });
  const remove = (passkey: PasskeyInfo) =>
    run("remove", async () => {
      apply(await online.removePasskey(passkey.id));
      return { kind: "done", message: "removed" };
    });
  const deleteEverything = () =>
    run("delete", async () => {
      await online.deleteAccount();
      refreshPlayer();
      await queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY });
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void syncDaily(true);
      return null;
    });

  return (
    <main className="mg-shell" data-testid="profile" data-account={isAccount} data-ready={data !== undefined}>
      <PageHeader title={t("profile.title")} />

      {/* Who the player is. */}
      <section className="mg-card" data-testid="profile-card">
        <ProfileEditor draft={draft} onSaved={() => void queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY })} />
        {me && (me.streak > 0 || me.bestStreak > 0) && (
          <p className="flex items-center gap-1.5 text-sm text-[var(--ink-soft)]">
            <FlameIcon className="w-4 h-4 flex-none text-[var(--accent)]" /> {t("profile.streak", { count: me.streak, best: me.bestStreak })}
          </p>
        )}
      </section>

      {/* How the player is reached: from this device alone, or with a passkey from anywhere. */}
      {data === undefined ? (
        <p className="mg-status" role="status">
          {account.error ? t("offline") : t("account.loading")}
        </p>
      ) : (
        <section className="mg-card" data-testid="account-card">
          <div className="flex flex-col gap-1.5">
            <span className="mg-tag self-start" data-testid="account-kind">
              {t(isAccount ? "account.kindAccount" : "account.kindDevice")}
            </span>
            <h2 className={CARD_TITLE}>{t(isAccount ? "account.accountTitle" : "account.deviceTitle")}</h2>
            <p className={BODY}>{t(isAccount ? "account.accountBody" : "account.deviceBody")}</p>
          </div>

          {isAccount && (
            <ul className="flex flex-col gap-2" aria-label={t("account.passkeys")} data-testid="passkeys">
              {data.passkeys.map((passkey) => (
                <PasskeyRow key={passkey.id} passkey={passkey} removable={data.passkeys.length > 1} disabled={busy !== null} onRemove={() => setRemoving(passkey)} />
              ))}
            </ul>
          )}

          {notice && (
            <p className={`flex items-start gap-1.5 text-sm font-semibold ${notice.kind === "problem" && notice.problem !== "cancelled" ? "text-[var(--invalid)]" : notice.kind === "done" ? "text-[var(--valid)]" : "text-[var(--ink-soft)]"}`} role="status" data-testid="account-notice" data-kind={notice.kind === "done" ? notice.message : notice.problem}>
              {notice.kind === "done" && <CheckIcon className="w-4 h-4 flex-none mt-0.5" />}
              {notice.kind === "done" ? t(`account.done.${notice.message}`) : t(`account.errors.${notice.problem}`)}
            </p>
          )}
          {(busy === "create" || busy === "signIn") && (
            <p className={BODY} role="status">
              {t("account.working")}
            </p>
          )}

          {!hydrated ? null : !supported ? (
            <p className={BODY} data-testid="account-unsupported">
              {t("account.unsupported")}
            </p>
          ) : isAccount ? (
            <div className="mg-actions">
              <button type="button" className="mg-button" onClick={create} disabled={busy !== null} data-testid="passkey-add">
                <KeyIcon /> {t("account.add")}
              </button>
              <button type="button" className="mg-button" onClick={signOut} disabled={busy !== null} data-testid="account-sign-out">
                <SignOutIcon /> {t("account.signOut")}
              </button>
            </div>
          ) : (
            <div className="mg-actions">
              <button type="button" className="mg-button" data-variant="primary" onClick={create} disabled={busy !== null} data-testid="account-create">
                <KeyIcon /> {t("account.create")}
              </button>
              <button type="button" className="mg-button" onClick={signIn} disabled={busy !== null} data-testid="account-sign-in">
                {t("account.signIn")}
              </button>
            </div>
          )}
        </section>
      )}

      {/* The player this device had before the sign-in, with scores of its own. It joins the account only when asked to. */}
      {data?.device && (
        <section className="mg-card" data-testid="account-merge">
          <div className="flex flex-col gap-1.5">
            <h2 className={CARD_TITLE}>{t("account.mergeTitle")}</h2>
            <p className={BODY}>{t("account.mergeBody")}</p>
          </div>
          <div className="mg-row">
            <PlayerAvatar seed={data.device.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <div className="mg-player-line">
                <span className="mg-player-name">{data.device.name}</span>
              </div>
              <div className="flex flex-wrap gap-x-2.5 text-xs text-[var(--ink-soft)] whitespace-nowrap">
                <span className="mg-nickname">@{data.device.nickname}</span>
                <span>{t("ranking.solved", { count: data.device.solved })}</span>
              </div>
            </div>
            <div className="font-semibold tabular-nums flex-none whitespace-nowrap">{t("ranking.points", { points: data.device.points })}</div>
          </div>
          <button type="button" className="mg-button" data-variant="primary" onClick={merge} disabled={busy !== null} data-testid="account-merge-button">
            {t("account.merge")}
          </button>
        </section>
      )}

      {player && (
        <button type="button" className="mg-text-link text-sm text-[var(--ink-soft)]" onClick={() => setDeleting(true)} disabled={busy !== null} data-testid="account-delete">
          {t("account.deleteLink")}
        </button>
      )}

      <SiteFooter current="profile" />

      <ConfirmDialog
        open={removing !== null}
        title={t("account.removeTitle")}
        confirmLabel={t("account.removeConfirm")}
        testId="passkey-confirm"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const passkey = removing;
          setRemoving(null);
          if (passkey) void remove(passkey);
        }}
      >
        {t("account.removeBody")}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting}
        title={t("account.deleteTitle")}
        confirmLabel={t("account.deleteConfirm")}
        testId="account-delete-confirm"
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          void deleteEverything();
        }}
      >
        {t("account.deleteBody")}
      </ConfirmDialog>
    </main>
  );
}
