"use client";

import { useMemo, useState } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import { type WendState, foundWords } from "../../engine/game/state";
import { useWendGame } from "../../hooks/use-wend-game";
import { wordColors } from "../board/palette";
import { WendBoard } from "../board/wend-board";
import { WendWordList } from "../board/word-list";
import { WEND_TUTORIAL_PUZZLE } from "./tutorial-puzzle";

type Step = { title: string; body: string; done: (game: WendState) => boolean };

// The tutorial is in Portuguese, like every text of this game: the words on the board are Portuguese.
const STEPS: Step[] = [
  {
    title: "Ligue as letras",
    body: "Arraste o dedo pelas letras vizinhas para formar uma palavra. O tema é frutas: comece pelo U e trace UVA na linha de cima.",
    done: (game) => foundWords(game).length >= 1,
  },
  {
    title: "As palavras fazem curvas",
    body: "Uma palavra anda para os lados, para cima e para baixo, nunca na diagonal, e desvia das paredes. Falta uma fruta de 4 letras, que começa no F.",
    done: (game) => game.status === "solved",
  },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const game = useWendGame({ puzzle: WEND_TUTORIAL_PUZZLE, settings, persist: false });
  const colors = useMemo(() => wordColors(WEND_TUTORIAL_PUZZLE.id, WEND_TUTORIAL_PUZZLE.words.length), []);

  // Steps only move forward. A player who works ahead skips the steps they already satisfied.
  const [stepIndex, setStepIndex] = useState(0);
  if (stepIndex < STEPS.length && STEPS[stepIndex].done(game.game)) setStepIndex(stepIndex + 1);

  const finished = stepIndex >= STEPS.length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((entry, index) => (
          <span key={entry.title} className="h-1.5 flex-1 rounded-full" style={{ background: index < stepIndex ? "var(--valid)" : index === stepIndex ? "var(--ink)" : "var(--thread)" }} />
        ))}
      </div>

      <div aria-live="polite" className="min-h-[104px]">
        <h3 className="font-bold mb-1">{finished ? "É só isso" : `${stepIndex + 1}. ${step.title}`}</h3>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {finished
            ? "Cada letra pertence a uma única palavra, e todas as palavras têm o mesmo tema. Um traço cinza é só um rascunho: ele ganha cor quando a palavra está certa. Toque na primeira letra de um traço para apagá-lo. O relógio começa quando o tabuleiro aparece."
            : step.body}
        </p>
      </div>

      <div className="w-full max-w-[220px] mx-auto wend-stage">
        <WendBoard
          shape={WEND_TUTORIAL_PUZZLE}
          trails={game.game.trails}
          active={game.game.active}
          colors={colors}
          locked={finished || game.locked || game.busy}
          solved={game.game.status === "solved"}
          hintCell={game.hintCell}
          foundSignal={game.foundSignal}
          label="Tabuleiro do tutorial, 3 por 3"
          testId="wend-tutorial-board"
          onPress={game.press}
          onDrag={game.drag}
          onRelease={game.release}
          onTap={game.tap}
          onBack={game.back}
        />
        <WendWordList shape={WEND_TUTORIAL_PUZZLE} state={game.game} colors={colors} theme="Frutas" themeShown />
      </div>

      <p className="text-center text-sm min-h-[40px] text-[var(--ink-soft)]">{game.status.kind === "hint" || game.status.kind === "info" ? game.status.text : ""}</p>

      {finished ? (
        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          Começar a jogar
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="mg-button" onClick={game.undo} disabled={!game.canUndo}>
            <UndoIcon /> Desfazer
          </button>
          <button type="button" className="mg-button" onClick={game.requestHint}>
            <HintIcon /> Dica
          </button>
          <button type="button" className="mg-button" onClick={onClose}>
            Pular
          </button>
        </div>
      )}
    </div>
  );
}

export function WendTutorialDialog({ open, settings, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Como jogar Wend" testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
