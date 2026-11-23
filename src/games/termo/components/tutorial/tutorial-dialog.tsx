"use client";

import type { CSSProperties } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import type { LetterMark } from "../../engine/types";

type Props = { open: boolean; settings: Settings; onClose: () => void };

type Example = { word: string; at: number; mark: LetterMark; text: string };

/** Three words of our own, each showing one of the three marks. */
const EXAMPLES: Example[] = [
  { word: "FESTA", at: 0, mark: "right", text: "A letra F está na palavra e no lugar certo." },
  { word: "CAMPO", at: 2, mark: "place", text: "A letra M está na palavra, mas em outra posição." },
  { word: "NUVEM", at: 3, mark: "wrong", text: "A letra E não está na palavra." },
];

function ExampleRow({ example }: { example: Example }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="termo-example" role="img" aria-label={`${example.word}. ${example.text}`}>
        {[...example.word].map((letter, index) => (
          <div key={index} className="termo-tile" data-mark={index === example.at ? example.mark : undefined} style={{ "--column": index } as CSSProperties}>
            {letter}
          </div>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{example.text}</p>
    </div>
  );
}

export function TermoTutorialDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Como jogar Termo" testId="game-tutorial">
      <div className="termo-stage flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          Descubra a palavra escondida de 5 letras. Digite uma palavra e aperte Enter: cada letra mostra o quanto você chegou perto.
        </p>

        {EXAMPLES.map((example) => (
          <ExampleRow key={example.word} example={example} />
        ))}

        <ul className="text-sm leading-relaxed text-[var(--ink-soft)] list-disc pl-5 flex flex-col gap-1">
          <li>Acentos e cedilha não são digitados. O jogo completa sozinho, e eles não contam nas dicas.</li>
          <li>Uma palavra pode ter letras repetidas.</li>
          <li>No teclado, a tecla de apagar tira uma letra e Limpar esvazia a linha inteira. Toque em uma casa para mover o cursor.</li>
          <li>No Termo é 1 palavra em 6 tentativas. No Dueto são 2 palavras ao mesmo tempo em 7 tentativas, e no Quarteto são 4 em 9. Cada palpite vale para todas.</li>
          <li>Hint revela uma letra no lugar certo. Reveal mostra a resposta e encerra a partida.</li>
        </ul>

        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          Começar
        </button>
      </div>
    </Dialog>
  );
}
