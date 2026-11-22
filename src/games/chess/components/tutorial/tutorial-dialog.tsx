"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon } from "@/shared/ui/icons";
import { useChessGame } from "../../hooks/use-chess-game";
import { ChessBoard } from "../board/chess-board";
import { CoachAvatar } from "../coach/coach-avatar";
import { CHESS_TUTORIAL_PUZZLE } from "./tutorial-puzzle";

type Step = { title: string; body: string };

const STEPS: Step[] = [
  {
    title: "O adversário joga primeiro",
    body: "Todo problema começa com o último lance do adversário. Aqui as pretas tiraram a torre da última fileira. Foi um erro, e cabe a você punir.",
  },
  {
    title: "Faça o seu lance",
    body: "Arraste uma peça, ou toque nela e depois na casa de destino. Os pontos mostram para onde ela pode ir. Encontre o xeque-mate em 1 lance.",
  },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const game = useChessGame({ puzzle: CHESS_TUTORIAL_PUZZLE, settings, persist: false });
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

  return (
    <div className="flex flex-col gap-3" lang="pt-BR">
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((entry, index) => (
          <span key={entry.title} className="h-1.5 flex-1 rounded-full" style={{ background: index < stepIndex ? "var(--valid)" : index === stepIndex ? "var(--ink)" : "var(--thread)" }} />
        ))}
      </div>

      <div aria-live="polite" className="min-h-[104px]">
        <h3 className="font-bold mb-1">{finished ? "É assim que funciona" : `${stepIndex + 1}. ${step.title}`}</h3>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {finished
            ? "A treinadora Sofia comenta cada lance. Se errar, ela explica o que o lance permite: toque no tabuleiro para voltar e tentar de novo. A primeira dica mostra a peça, a segunda joga o lance. O relógio só para quando o problema é resolvido."
            : step.body}
        </p>
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
          label="Tabuleiro do tutorial. Você joga de brancas."
          onMove={game.tryMove}
          onTakeBack={game.takeBack}
        />
      </div>

      <div className="flex items-end gap-2 min-h-[58px]">
        <CoachAvatar mood={latest?.mood ?? "calm"} className="w-9 h-9 flex-none rounded-full" />
        <p className="text-sm leading-snug text-[var(--ink-soft)]">{game.status.kind === "invalid" ? game.status.text : (latest?.text ?? "")}</p>
      </div>

      {finished ? (
        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          Começar a jogar
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="mg-button" onClick={game.requestHint} disabled={!game.opened}>
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

export function ChessTutorialDialog({ open, settings, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Como jogar" testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
