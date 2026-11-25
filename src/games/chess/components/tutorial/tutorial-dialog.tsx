"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LOCALE_META } from "@/i18n/config";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon } from "@/shared/ui/icons";
import { useChessGame } from "../../hooks/use-chess-game";
import { ChessBoard } from "../board/chess-board";
import { CoachAvatar } from "../coach/coach-avatar";
import { CHESS_TUTORIAL_PUZZLE } from "./tutorial-puzzle";

/** The steps in order. Titles and bodies are in the "chess" messages, under tutorial.steps.<id>. */
const STEPS = ["opponent", "move"] as const;

type Props = { open: boolean; settings: Settings; onClose: () => void };

/**
 * The steps are in the interface locale, like every tutorial. The coach's line
 * under the board is hers, so it is in the game language.
 */
function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const t = useTranslations("chess");
  const common = useTranslations("common.tutorial");
  const { language } = useGameLanguage();
  const game = useChessGame({ puzzle: CHESS_TUTORIAL_PUZZLE, settings, language, persist: false });
  const { begin } = game;
  useEffect(() => begin(), [begin]);

  // Steps only move forward: the opening move, then the mate.
  const [stepIndex, setStepIndex] = useState(0);
  const reached = game.game.status === "solved" ? 2 : game.opened ? 1 : 0;
  if (reached > stepIndex) setStepIndex(reached);

  const finished = stepIndex >= STEPS.length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const awaitingTakeBack = game.game.wrong !== null && !game.busy;
  const latest = game.messages[game.messages.length - 1];
  const { text } = game.coach;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((entry, index) => (
          <span key={entry} className="h-1.5 flex-1 rounded-full" style={{ background: index < stepIndex ? "var(--valid)" : index === stepIndex ? "var(--ink)" : "var(--thread)" }} />
        ))}
      </div>

      <div aria-live="polite" className="min-h-[104px]">
        <h3 className="font-bold mb-1">{finished ? t("tutorial.doneTitle") : common("step", { number: stepIndex + 1, title: t(`tutorial.steps.${step}.title`) })}</h3>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{finished ? t("tutorial.doneBody") : t(`tutorial.steps.${step}.body`)}</p>
      </div>

      <div className="w-full max-w-[270px] mx-auto">
        <ChessBoard
          view={game.view}
          orientation={game.solverColor}
          targets={game.targets}
          locked={game.locked || !game.opened || game.busy}
          awaitingTakeBack={awaitingTakeBack}
          hintSquare={game.hintSquare}
          verdict={game.verdict}
          shakeSignal={game.shakeSignal}
          label={t("board.tutorialLabel")}
          onMove={game.tryMove}
          onTakeBack={game.takeBack}
        />
      </div>

      <div className="flex items-end gap-2 min-h-[58px]" lang={LOCALE_META[game.coach.language].htmlLang} data-testid="chess-tutorial-coach">
        <CoachAvatar mood={latest?.mood ?? "calm"} label={`${text.name}, ${text.role.toLowerCase()}`} className="w-9 h-9 flex-none rounded-full" />
        <p className="text-sm leading-snug text-[var(--ink-soft)]">{game.status.kind === "invalid" ? game.status.text : (latest?.text ?? "")}</p>
      </div>

      {finished ? (
        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          {common("start")}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="mg-button" onClick={game.requestHint} disabled={!game.opened}>
            <HintIcon /> {common("hint")}
          </button>
          <button type="button" className="mg-button" onClick={onClose}>
            {common("skip")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ChessTutorialDialog({ open, settings, onClose }: Props) {
  const t = useTranslations("chess.tutorial");
  return (
    <Dialog open={open} onClose={onClose} title={t("title")} testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
