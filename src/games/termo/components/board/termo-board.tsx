"use client";

import { type CSSProperties, useEffect, useRef } from "react";
import type { TermoRow } from "../../engine/game/state";
import type { LetterMark } from "../../engine/types";
import { WORD_LENGTH, displayWord } from "../../engine/words";

export type TermoBoardView = {
  rows: readonly TermoRow[];
  solved: boolean;
  /** Letters given by hints, by position. Shown in the row being typed wherever nothing was typed over them. */
  hints: readonly string[];
  /** The hidden word, plain. Only set once the game is over and this board was not solved. */
  answer: string | null;
};

type Props = {
  boards: readonly TermoBoardView[];
  /** Where the next letter goes in the row being typed. */
  cursor: number;
  /** Index of the guess that was just played. Its tiles turn over. */
  freshRow: number | null;
  shaking: boolean;
  locked: boolean;
  label: string;
  onCell: (index: number) => void;
};

const MARK_TEXT: Record<LetterMark, string> = { right: "no lugar certo", place: "em outra posição", wrong: "fora da palavra" };

/** Letters of a played row as they are written: "maca" shows as M A Ç Ã. */
function shownLetters(row: TermoRow): string[] {
  if (row.kind !== "played") return row.letters.map((letter) => letter.toUpperCase());
  const spelled = [...displayWord(row.letters.join("")).toUpperCase()];
  return spelled.length === WORD_LENGTH ? spelled : row.letters.map((letter) => letter.toUpperCase());
}

/**
 * One grid of guesses per hidden word. Past rows carry the marks of their
 * guess. The row being typed is the same on every open board, and its cells are
 * buttons that move the cursor.
 */
export function TermoBoard({ boards, cursor, freshRow, shaking, locked, label, onCell }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const played = boards.reduce((most, board) => Math.max(most, board.rows.filter((row) => row.kind === "played").length), 0);

  // With four boards the page scrolls under the keyboard. Keep the row being typed in view after each guess.
  useEffect(() => {
    if (boards.length < 4 || played === 0) return;
    const rows = root.current?.querySelectorAll<HTMLElement>('[data-kind="current"]');
    rows?.[rows.length - 1]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [boards.length, played]);

  return (
    <div className="termo-stage">
      <div ref={root} className="termo-boards" data-boards={boards.length} data-locked={locked} data-testid="termo-board" role="group" aria-label={label} style={{ "--rows": boards[0]?.rows.length ?? 6 } as CSSProperties}>
        {boards.map((board, boardIndex) => (
          <div key={boardIndex} className="termo-grid" data-board={boardIndex} data-solved={board.solved} data-testid="termo-grid" role="group" aria-label={boards.length > 1 ? `Palavra ${boardIndex + 1} de ${boards.length}${board.solved ? ", encontrada" : ""}` : "Tentativas"}>
            {board.rows.map((row, rowIndex) => {
              const letters = shownLetters(row);
              return (
                <div key={rowIndex} className="termo-row" data-kind={row.kind} data-row={rowIndex} data-fresh={row.kind === "played" && rowIndex === freshRow} data-shake={row.kind === "current" && shaking} data-testid="termo-row" role="group" aria-label={`Tentativa ${rowIndex + 1}`}>
                  {letters.map((letter, column) => {
                    const mark = row.marks?.[column];
                    const hint = row.kind === "current" ? board.hints[column].toUpperCase() : "";
                    const style = { "--column": column } as CSSProperties;
                    if (row.kind !== "current") {
                      return (
                        <div key={column} className="termo-tile" data-mark={mark} data-column={column} data-testid="termo-tile" style={style} role="img" aria-label={mark ? `${letter}, ${MARK_TEXT[mark]}` : "vazio"}>
                          <span aria-hidden="true">{letter}</span>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={column}
                        type="button"
                        className="termo-tile"
                        data-column={column}
                        data-cursor={column === cursor}
                        data-filled={letter !== ""}
                        data-hint={hint !== ""}
                        data-testid="termo-tile"
                        style={style}
                        tabIndex={-1}
                        aria-label={`Posição ${column + 1}: ${letter !== "" ? letter : "vazia"}${hint !== "" ? `, dica ${hint}` : ""}${column === cursor ? ", cursor" : ""}`}
                        // Keeps the focus where it is, so the physical keyboard goes on typing into the row.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onCell(column)}
                      >
                        <span aria-hidden="true">{letter !== "" ? letter : hint}</span>
                        {/* A hint stays in sight when another letter is typed over it. */}
                        {hint !== "" && letter !== "" && letter !== hint && (
                          <span className="termo-hint-badge" aria-hidden="true">
                            {hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {board.answer && (
              <p className="termo-answer" data-testid="termo-answer">
                {displayWord(board.answer).toUpperCase()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
