import type { CSSProperties } from "react";
import { CheckIcon } from "@/shared/ui/icons";
import { type WendState, foundWords, trailLetters, wordListRows } from "../../engine/game/state";
import type { WendShape } from "../../engine/types";

type Props = {
  shape: WendShape;
  state: WendState;
  colors: readonly string[];
  theme: string;
  /** False while the theme is still a secret: the harder tiers show it after the first word. */
  themeShown: boolean;
};

/**
 * Under the board: the letters of the trail being drawn, the theme, and one row
 * of blanks per hidden word, stacked from the shortest word to the longest. A
 * row fills in and gets a check mark when its word is found. Before that it
 * only ever shows letters a hint revealed.
 */
export function WendWordList({ shape, state, colors, theme, themeShown }: Props) {
  const rows = wordListRows(shape, state);
  const found = foundWords(state).length;
  const active = state.trails.find((trail) => trail.id === state.active && trail.word === null);
  const tracing = active ? trailLetters(shape, active.cells) : "";
  const visible = themeShown || found > 0 || state.revealed;

  return (
    <div className="wend-panel">
      <p className="wend-tracing" data-testid="wend-tracing" data-empty={tracing === "" || undefined} aria-label={tracing === "" ? "Nenhum traço em andamento" : `Traço em andamento: ${tracing}`}>
        {tracing === "" ? <span className="wend-tracing-idle">Arraste pelas letras para formar uma palavra</span> : [...tracing].map((letter, index) => <span key={index}>{letter}</span>)}
      </p>

      <div className="wend-list-head">
        <span data-testid="wend-theme">
          Tema: <strong>{visible ? theme : "encontre uma palavra para ver"}</strong>
        </span>
        <span data-testid="wend-count" aria-label={`${found} de ${shape.words.length} palavras encontradas`}>
          {found} de {shape.words.length}
        </span>
      </div>

      <ul className="wend-list" data-testid="wend-list" aria-label="Palavras escondidas">
        {shape.words.map((word, index) => {
          const row = rows[index];
          return (
            <li
              key={word.text}
              className="wend-row"
              data-testid={`wend-row-${index}`}
              data-found={row.found || undefined}
              style={{ "--word": colors[index] } as CSSProperties}
              aria-label={row.found ? `${word.display}, encontrada` : `Palavra de ${word.text.length} letras${row.shown > 0 ? `, começa com ${word.display.slice(0, row.shown)}` : ""}`}
            >
              {[...word.display].map((letter, at) => (
                <span key={at} className="wend-slot" data-shown={at < row.shown || undefined} aria-hidden="true">
                  {at < row.shown ? letter : ""}
                </span>
              ))}
              {row.found && <CheckIcon className="wend-check" data-testid="wend-check" aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
