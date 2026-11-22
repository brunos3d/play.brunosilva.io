import { LETTERS_PT, lineToSan, toSan } from "../notation";
import { BLACK, type Color, KING, type Move, type Position, moveCaptured, movePiece, movePromotion, squareName } from "../position";
import { type ResolvedPuzzle, positionAfter } from "../puzzle";
import type { ChessTheme } from "../types";
import type { Feedback, IllegalReason } from "./feedback";

/**
 * Everything the coach says, in Brazilian Portuguese. The rest of the platform
 * speaks English. The coach is the one voice that teaches, and it was asked
 * for in Portuguese, so all of its text lives in this one file.
 *
 * Moves are written in Portuguese notation: R rei, D dama, T torre, B bispo,
 * C cavalo. A message never names the move the player has to find, except for
 * the second hint and the reveal, which exist to do exactly that.
 */
export type CoachMood = "calm" | "happy" | "worried" | "thinking";
export type CoachMessage = { mood: CoachMood; text: string };

type Noun = { name: string; feminine: boolean };
const PIECES: readonly Noun[] = [
  { name: "peça", feminine: true },
  { name: "peão", feminine: false },
  { name: "cavalo", feminine: false },
  { name: "bispo", feminine: false },
  { name: "torre", feminine: true },
  { name: "dama", feminine: true },
  { name: "rei", feminine: false },
];

const the = (type: number): string => `${PIECES[type].feminine ? "a" : "o"} ${PIECES[type].name}`;
const your = (type: number): string => `${PIECES[type].feminine ? "a sua" : "o seu"} ${PIECES[type].name}`;
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const sides = (color: Color): string => (color === BLACK ? "pretas" : "brancas");
const moves = (count: number): string => (count === 1 ? "1 lance" : `${count} lances`);
/** Picks one of several wordings. `variant` is a counter kept by the caller, so the choice is repeatable. */
const pick = (options: readonly string[], variant: number): string => options[((variant % options.length) + options.length) % options.length];

const san = (position: Position, move: Move): string => toSan(position, move, LETTERS_PT);

/** First message of a puzzle: what the opponent just played and what is asked. */
export function introMessage(puzzle: ResolvedPuzzle): CoachMessage {
  const before = positionAfter(puzzle, []);
  // positionAfter already played the opening move, so its notation is read from the position before it.
  before.unmake(puzzle.setup);
  const played = san(before, puzzle.setup);
  const opponent = capital(`as ${sides((puzzle.solver ^ 1) as Color)}`);
  const you = `Você joga de ${sides(puzzle.solver)}`;
  const { kind, mateIn } = puzzle.shape;
  const solverMoves = (puzzle.line.length + 1) / 2;

  if (kind === "mate") {
    const text = mateIn === 1 ? `${opponent} jogaram ${played} e deixaram o rei sem saída. ${you}: dê xeque-mate em 1 lance.` : `${opponent} jogaram ${played}. Foi um erro: existe xeque-mate forçado em ${moves(mateIn)}. ${you}.`;
    return { mood: "calm", text };
  }
  if (kind === "defence") return { mood: "calm", text: `${opponent} jogaram ${played} e criaram uma ameaça séria. ${you}, e só um lance mantém a posição de pé.` };
  const text = solverMoves === 1 ? `${opponent} jogaram ${played} e deixaram material de graça. ${you}: encontre o lance que ganha.` : `${opponent} jogaram ${played}. Parece seguro, mas perde material em ${moves(solverMoves)}. ${you}.`;
  return { mood: "calm", text };
}

/** After a right move that is not the last one. `position` is the board before the move, and `reply` is the opponent's answer. */
export function praiseMessage(position: Position, move: Move, reply: Move, variant: number): CoachMessage {
  const played = san(position, move);
  position.make(move);
  const answer = san(position, reply);
  position.unmake(move);
  const opening = pick([`Boa! ${played} é o lance.`, `Isso mesmo, ${played}.`, `Exato: ${played}.`, `Muito bem, ${played}.`], variant);
  const closing = pick(["Como continuar?", "E agora?", "Qual é o próximo passo?", "Falta terminar o serviço."], variant >> 1);
  return { mood: "happy", text: `${opening} O adversário respondeu ${answer}. ${closing}` };
}

/** After the move that solves the puzzle. `position` is the board before it. */
export function solvedMessage(puzzle: ResolvedPuzzle, position: Position, move: Move, variant: number): CoachMessage {
  const played = san(position, move);
  const { kind } = puzzle.shape;
  if (played.endsWith("#")) return { mood: "happy", text: pick([`Xeque-mate! ${played} encerra a partida. Muito bem.`, `${played} e acabou: xeque-mate. Belo lance!`, `Mate com ${played}. Perfeito!`], variant) };
  if (kind === "defence") return { mood: "happy", text: `${played} era o único lance. Posição salva, muito bem!` };
  if (movePromotion(move)) return { mood: "happy", text: `${played}! O peão virou ${PIECES[movePromotion(move)].name} e a vantagem é sua.` };
  const prize = moveCaptured(move);
  if (prize) return { mood: "happy", text: pick([`${played}! Você ganhou ${the(prize)}. Problema resolvido.`, `Perfeito: ${played} leva ${the(prize)}.`, `${capital(the(prize))} é ${PIECES[prize].feminine ? "sua" : "seu"} com ${played}. Muito bem!`], variant) };
  return { mood: "happy", text: `${played}! Agora a vantagem é sua. Problema resolvido.` };
}

/**
 * After a wrong move. `position` is the board before the move. The text says
 * what the move allows or misses, and never what should have been played.
 */
export function wrongMessage(position: Position, move: Move, feedback: Feedback, variant: number): CoachMessage {
  const played = san(position, move);
  const moved = movePromotion(move) || movePiece(move);
  position.make(move);
  const answer = (reply: Move | null): string => (reply === null || reply === 0 ? "" : san(position, reply));
  let text: string;

  switch (feedback.kind) {
    case "mated": {
      const reply = answer(feedback.reply);
      text = feedback.mateIn === 1 ? `Cuidado! Depois de ${played}, ${reply} é xeque-mate contra você.` : `Cuidado! ${played} permite ${reply}, e o adversário dá mate em 2 lances.`;
      break;
    }
    case "loses-material": {
      const reply = answer(feedback.reply);
      const square = squareName(feedback.square);
      if (feedback.lost === 0) text = `${played} não funciona: depois de ${reply} você perde material.`;
      else if (feedback.moved) {
        text = pick(
          [
            `E ${your(feedback.lost)}? Em ${square} ${PIECES[feedback.lost].feminine ? "ela é capturada" : "ele é capturado"} com ${reply}.`,
            `Opa, ${your(feedback.lost)} ficou sem proteção em ${square}. O adversário joga ${reply}.`,
          ],
          variant,
        );
      } else if (moved !== KING && moved !== feedback.lost) {
        text = `Você moveu ${the(moved)}, mas e ${your(feedback.lost)}? O adversário captura em ${square} com ${reply}.`;
      } else {
        text = `Mas e ${your(feedback.lost)}? Depois de ${played}, o adversário captura em ${square} com ${reply}.`;
      }
      break;
    }
    case "check-answered":
      text = pick([`${played} é xeque, mas depois de ${answer(feedback.reply)} o ataque acaba. O mate precisa ser forçado até o fim.`, `Xeque não é mate: o adversário responde ${answer(feedback.reply)} e escapa. Procure um xeque mais forte.`], variant);
      break;
    case "too-slow":
      text = pick([`${played} dá tempo para o rei adversário se defender. Em um mate forçado, comece pelos xeques.`, `Sem xeque, o adversário respira. Procure um lance que não deixe escolha.`], variant);
      break;
    case "slower-mate":
      text = `${played} também vence, mas existe um mate mais rápido. Tente de novo.`;
      break;
    case "small-gain":
      text = pick([`Capturar ${the(feedback.taken)} é pouco. Tem um prêmio maior no tabuleiro.`, `${played} ganha ${the(feedback.taken)}, mas o erro do adversário vale mais do que isso.`], variant);
      break;
    case "misses": {
      const reply = answer(feedback.reply);
      text = reply ? pick([`Depois de ${played}, o adversário joga ${reply} e a chance desaparece.`, `${played} deixa passar: com ${reply} o adversário se recompõe.`], variant) : `${played} deixa a chance passar. Olhe de novo para o último lance do adversário.`;
      break;
    }
  }
  position.unmake(move);
  return { mood: "worried", text };
}

const THEME_HINTS: Partial<Record<ChessTheme, string>> = {
  backRankMate: "O rei adversário está preso na última fileira.",
  smotheredMate: "O rei adversário está cercado pelas próprias peças.",
  sacrifice: "Às vezes vale entregar uma peça para abrir o caminho.",
  fork: "Procure um lance que ataque duas peças ao mesmo tempo.",
  discoveredAttack: "Mover uma peça pode abrir a linha de outra.",
  hangingPiece: "Há uma peça adversária sem defesa.",
  promotion: "Um peão está perto de virar dama.",
  defensiveMove: "Veja o que o último lance do adversário está atacando.",
};

/** First hint for a move: which piece moves, plus the idea behind the puzzle. The board highlights the piece's square. */
export function pieceHintMessage(puzzle: ResolvedPuzzle, move: Move): CoachMessage {
  const idea = puzzle.shape.themes.map((theme) => THEME_HINTS[theme]).find((text) => text !== undefined);
  const piece = movePiece(move);
  const lead = `Dica: quem joga agora é ${the(piece)} em ${squareName(move & 63)}.`;
  return { mood: "thinking", text: idea ? `${lead} ${idea}` : puzzle.shape.kind === "mate" ? `${lead} Procure um xeque.` : lead };
}

/** Second hint: the coach plays the move. `position` is the board before it. */
export function moveHintMessage(position: Position, move: Move): CoachMessage {
  return { mood: "thinking", text: `O lance era ${san(position, move)}. Repare por que ele funciona.` };
}

/** A hint asked for while a wrong move is on the board: the coach takes it back. */
export function takeBackHintMessage(): CoachMessage {
  return { mood: "thinking", text: "Voltei o seu lance: ele não resolve. Tente outro caminho, ou peça outra dica." };
}

export function illegalMessage(reason: IllegalReason, piece: number, square: number): string {
  if (reason === "in-check") return "Seu rei está em xeque. O lance precisa tirar o rei do xeque.";
  if (reason === "exposes-king") return "Esse lance deixaria o seu rei em xeque.";
  return `${capital(the(piece))} não pode ir para ${squareName(square)}.`;
}

/** The whole solution in notation, for the reveal. */
export function revealMessage(puzzle: ResolvedPuzzle): CoachMessage {
  return { mood: "calm", text: `A solução era ${lineToSan(positionAfter(puzzle, []), puzzle.line, LETTERS_PT)}. Acompanhe no tabuleiro.` };
}

export const COACH_TEXT = {
  name: "Sofia",
  role: "Treinadora",
  undone: "Lance desfeito. É a sua vez.",
  reset: "Voltamos ao começo do problema. O relógio continua correndo.",
  takeBack: "Toque no tabuleiro para voltar o lance.",
  resumed: "Você parou aqui. É a sua vez.",
  revealed: "Solução revelada. Estude a ideia e tente o próximo.",
  solvedBefore: "Este problema já foi resolvido.",
} as const;
