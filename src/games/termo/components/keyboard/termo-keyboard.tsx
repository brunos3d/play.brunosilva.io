"use client";

import type { LetterMark } from "../../engine/types";

type Props = {
  /** What is known about each letter, one map per board. */
  states: readonly ReadonlyMap<string, LetterMark>[];
  /** Boards whose word was found. Their share of each key goes quiet. */
  solved: readonly boolean[];
  disabled: boolean;
  onLetter: (letter: string) => void;
  onErase: () => void;
  onClear: () => void;
  onEnter: () => void;
};

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;
const MARK_TEXT: Record<LetterMark, string> = { right: "no lugar certo", place: "em outra posição", wrong: "fora da palavra" };

function describe(letter: string, states: Props["states"], solved: Props["solved"]): string {
  const name = letter.toUpperCase();
  if (states.length === 1) {
    const mark = states[0].get(letter);
    return mark ? `${name}, ${MARK_TEXT[mark]}` : name;
  }
  const parts = states.flatMap((board, index) => {
    const mark = board.get(letter);
    return mark && !solved[index] ? [`palavra ${index + 1}: ${MARK_TEXT[mark]}`] : [];
  });
  return parts.length > 0 ? `${name}, ${parts.join(", ")}` : name;
}

// A press must not take the focus: the physical keyboard keeps typing into the row, and Enter keeps meaning "play the word".
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

/**
 * On-screen keyboard. Each letter key shows the best that is known about that
 * letter. With two or four boards the key is cut in halves or quarters, one per
 * board, in the order the boards are drawn.
 */
export function TermoKeyboard({ states, solved, disabled, onLetter, onErase, onClear, onEnter }: Props) {
  const letterKey = (letter: string) => (
    <button key={letter} type="button" className="termo-key" data-key={letter} data-mark={states.length === 1 ? states[0].get(letter) : undefined} disabled={disabled} aria-label={describe(letter, states, solved)} onMouseDown={keepFocus} onClick={() => onLetter(letter)}>
      {states.length > 1 && (
        <span className="termo-key-parts" data-boards={states.length} aria-hidden="true">
          {states.map((board, index) => (
            <span key={index} data-mark={solved[index] ? "done" : board.get(letter)} />
          ))}
        </span>
      )}
      <span className="termo-key-label" aria-hidden="true">
        {letter}
      </span>
    </button>
  );

  return (
    <div className="termo-keyboard" role="group" aria-label="Teclado" data-testid="termo-keyboard">
      <div className="termo-keys">{[...ROWS[0]].map(letterKey)}</div>
      <div className="termo-keys">
        {[...ROWS[1]].map(letterKey)}
        <button type="button" className="termo-key" data-key="backspace" disabled={disabled} aria-label="Apagar letra" title="Apagar letra" onMouseDown={keepFocus} onClick={onErase}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7zM12 9.5l5 5M17 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="termo-keys">
        <button type="button" className="termo-key" data-key="clear" data-wide="true" disabled={disabled} aria-label="Limpar todas as letras da linha" title="Limpar a linha" onMouseDown={keepFocus} onClick={onClear}>
          <span className="termo-key-label">limpar</span>
        </button>
        {[...ROWS[2]].map(letterKey)}
        <button type="button" className="termo-key" data-key="enter" data-wide="true" disabled={disabled} aria-label="Enviar palavra" title="Enviar palavra" onMouseDown={keepFocus} onClick={onEnter}>
          <span className="termo-key-label">enter</span>
        </button>
      </div>
    </div>
  );
}
