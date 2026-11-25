import { BLACK, type Color, KING, type Move, PAWN, type Position, moveFrom, movePiece, movePromotion, opposite, squareName } from "../position";
import { type ResolvedPuzzle, positionAfter } from "../puzzle";
import type { ChessTheme } from "../types";
import type { Coach, CoachMessage, MoveForm } from "./coach";
import { type MoveFacts, capital, moveFacts, pick, positionBeforeSetup, solverMoves, themeHint } from "./facts";
import type { Feedback } from "./feedback";

/**
 * The coach in Brazilian Portuguese: the nouns and verbs of the move describer,
 * and every sentence she says.
 */

type Noun = { name: string; feminine: boolean };
/** Indexed by piece type. Index 0 is a piece of unknown type. */
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
const a = (type: number): string => `${PIECES[type].feminine ? "uma" : "um"} ${PIECES[type].name}`;
const your = (type: number): string => `${PIECES[type].feminine ? "a sua" : "o seu"} ${PIECES[type].name}`;
/** "pela torre", "pelo bispo": the agent of a passive sentence. */
const by = (type: number): string => `${PIECES[type].feminine ? "pela" : "pelo"} ${PIECES[type].name}`;
const sides = (color: Color): string => (color === BLACK ? "pretas" : "brancas");
const moves = (count: number): string => (count === 1 ? "1 lance" : `${count} lances`);

type Verb = Record<Exclude<MoveForm, "clause">, string>;
const verb = (infinitive: string, past: string, pastPlural: string, present: string, gerund: string): Verb => ({ infinitive, past, pastPlural, present, gerund });
const MOVE = verb("mover", "moveu", "moveram", "move", "movendo");
const ADVANCE = verb("avançar", "avançou", "avançaram", "avança", "avançando");
const CAPTURE = verb("capturar", "capturou", "capturaram", "captura", "capturando");
const CASTLE = verb("fazer", "fez", "fizeram", "faz", "fazendo");
const PROMOTE = verb("promover", "promoveu", "promoveram", "promove", "promovendo");

/**
 * The move itself, without what it gives. In `clause` the piece is the subject
 * ("a torre vai para d1"). In every other form the player is, and the phrase
 * starts with the verb ("mover a torre para d1").
 */
function phrase(facts: MoveFacts, form: MoveForm): string {
  const square = squareName(facts.to);
  // Two rooks that can both go there: "a torre de a1".
  const mover = `${the(facts.piece)}${facts.ambiguous ? ` de ${squareName(facts.from)}` : ""}`;

  if (facts.castle) {
    const castling = facts.castle === "king" ? "o roque pequeno" : "o roque grande";
    return form === "clause" ? `o rei faz ${castling}` : `${CASTLE[form]} ${castling}`;
  }
  if (facts.promotion) {
    const becomes = PIECES[facts.promotion].name;
    if (facts.captured) {
      const taken = `${the(facts.captured)} em ${square}`;
      return form === "clause" ? `${mover} captura ${taken} e vira ${becomes}` : `${CAPTURE[form]} ${taken} e ${PROMOTE[form]} ${mover} a ${becomes}`;
    }
    return form === "clause" ? `${mover} chega a ${square} e vira ${becomes}` : `${PROMOTE[form]} ${mover} a ${becomes} em ${square}`;
  }
  if (facts.enPassant) {
    return form === "clause" ? `${mover} captura en passant em ${square}` : `${CAPTURE[form]} o peão en passant em ${square}${facts.ambiguous ? ` com ${mover}` : ""}`;
  }
  if (facts.captured) {
    const taken = `${the(facts.captured)}${facts.recapture ? "" : ` em ${square}`}`;
    return form === "clause" ? `${mover} captura ${taken}` : `${CAPTURE[form]} ${taken} com ${mover}`;
  }
  if (facts.piece === PAWN) return form === "clause" ? `${mover} avança para ${square}` : `${ADVANCE[form]} ${mover} para ${square}`;
  return form === "clause" ? `${mover} vai para ${square}` : `${MOVE[form]} ${mover} para ${square}`;
}

/** What the move gives, to end the phrase with. A second gerund in a row reads badly, so that form joins with "e". */
function tail(facts: MoveFacts, form: MoveForm): string {
  if (facts.mate) return ": xeque-mate";
  if (facts.check) return form === "gerund" ? " e dando xeque" : ", dando xeque";
  return "";
}

function describeMove(position: Position, move: Move, form: MoveForm, after?: Move): string {
  const facts = moveFacts(position, move, after);
  return `${phrase(facts, form)}${tail(facts, form)}`;
}

function intro(puzzle: ResolvedPuzzle): CoachMessage {
  const opponent = `As ${sides(opposite(puzzle.solver))}`;
  const played = `${opponent} ${describeMove(positionBeforeSetup(puzzle), puzzle.setup, "pastPlural")}.`;
  const you = `Você joga de ${sides(puzzle.solver)}`;
  const { kind, mateIn } = puzzle.shape;
  const count = solverMoves(puzzle);

  if (kind === "mate") {
    const text = mateIn === 1 ? `${played} Com isso, o rei delas ficou sem saída. ${you}: dê xeque-mate em 1 lance.` : `${played} Foi um erro: existe xeque-mate forçado em ${moves(mateIn)}. ${you}.`;
    return { mood: "calm", text };
  }
  if (kind === "defence") return { mood: "calm", text: `${played} É uma ameaça séria. ${you}, e só um lance mantém a posição de pé.` };
  const text = count === 1 ? `${played} Esse lance deixou material de graça. ${you}: encontre o lance que ganha.` : `${played} Parece seguro, mas perde material em ${moves(count)}. ${you}.`;
  return { mood: "calm", text };
}

function praise(position: Position, move: Move, reply: Move, variant: number): CoachMessage {
  const played = describeMove(position, move, "clause");
  position.make(move);
  const answer = describeMove(position, reply, "gerund", move);
  position.unmake(move);
  const opening = pick([`Boa! ${capital(played)}.`, `Isso mesmo: ${played}.`, `Exato: ${played}.`, `Muito bem: ${played}.`], variant);
  const closing = pick(["Como continuar?", "E agora?", "Qual é o próximo passo?", "Falta terminar o serviço."], variant >> 1);
  return { mood: "happy", text: `${opening} O adversário respondeu ${answer}. ${closing}` };
}

function solved(puzzle: ResolvedPuzzle, position: Position, move: Move, variant: number): CoachMessage {
  const facts = moveFacts(position, move);
  const action = phrase(facts, "clause");
  if (facts.mate) {
    return { mood: "happy", text: pick([`Xeque-mate! ${capital(action)} e encerra a partida. Muito bem.`, `${capital(action)} e acabou: xeque-mate. Belo lance!`, `${capital(action)}: xeque-mate. Perfeito!`], variant) };
  }
  const played = `${action}${tail(facts, "clause")}`;
  if (puzzle.shape.kind === "defence") return { mood: "happy", text: `${capital(played)}: era o único lance. Posição salva, muito bem!` };
  if (facts.promotion) return { mood: "happy", text: `${capital(played)}. Agora a vantagem é sua.` };
  if (facts.captured) {
    return { mood: "happy", text: pick([`${capital(played)}. Material ganho, problema resolvido.`, `Perfeito: ${played}. A vantagem é sua.`, `Muito bem! ${capital(played)}. Você saiu ganhando.`], variant) };
  }
  return { mood: "happy", text: `${capital(played)}. Agora a vantagem é sua. Problema resolvido.` };
}

function wrong(position: Position, move: Move, feedback: Feedback, variant: number): CoachMessage {
  const moved = movePromotion(move) || movePiece(move);
  position.make(move);
  // The opponent's answer, told from the position the wrong move leaves.
  const answer = (reply: Move, form: MoveForm): string => describeMove(position, reply, form);
  let text: string;

  switch (feedback.kind) {
    case "mated":
      text = feedback.mateIn === 1 ? `Cuidado! Depois desse lance, o adversário ${answer(feedback.reply, "present")}.` : `Cuidado! Agora o adversário ${answer(feedback.reply, "present")}. O mate vem no lance seguinte.`;
      break;
    case "loses-material": {
      const square = squareName(feedback.square);
      if (feedback.lost === 0) text = `Esse lance não funciona. O adversário ${answer(feedback.reply, "present")}, e você perde material.`;
      else if (feedback.moved) {
        const taker = movePiece(feedback.reply);
        text = pick(
          [
            `E ${your(feedback.lost)}? Em ${square}, ${PIECES[feedback.lost].feminine ? "ela é capturada" : "ele é capturado"} ${by(taker)}.`,
            `Opa, ${your(feedback.lost)} ficou sem proteção em ${square}. O adversário captura com ${the(taker)}.`,
          ],
          variant,
        );
      } else if (moved !== KING && moved !== feedback.lost) {
        text = `Você moveu ${the(moved)}, mas e ${your(feedback.lost)}? O adversário ${answer(feedback.reply, "present")}.`;
      } else {
        text = `Mas e ${your(feedback.lost)}? Depois desse lance, o adversário ${answer(feedback.reply, "present")}.`;
      }
      break;
    }
    case "check-answered": {
      // The answer is not played on the board, so it is something the opponent can do.
      const reply = answer(feedback.reply, "infinitive");
      text = pick([`É xeque, mas não basta: o adversário pode ${reply}. O mate precisa ser forçado até o fim.`, `Xeque não é mate: aqui o adversário pode ${reply}. Procure um xeque mais forte.`], variant);
      break;
    }
    case "too-slow":
      text = pick(["Esse lance dá tempo para o rei adversário se defender. Em um mate forçado, comece pelos xeques.", "Sem xeque, o adversário respira. Procure um lance que não deixe escolha."], variant);
      break;
    case "slower-mate":
      text = "Esse lance também vence, mas existe um mate mais rápido. Tente de novo.";
      break;
    case "small-gain":
      text = pick([`Capturar ${the(feedback.taken)} é pouco. Tem um prêmio maior no tabuleiro.`, `Esse lance ganha ${a(feedback.taken)}, mas o erro do adversário vale mais do que isso.`], variant);
      break;
    case "misses": {
      if (!feedback.reply) text = "Esse lance deixa a chance passar. Olhe de novo para o último lance do adversário.";
      else {
        const reply = answer(feedback.reply, "infinitive");
        text = pick([`Depois desse lance, o adversário pode ${reply}, e a chance desaparece.`, `Esse lance deixa a chance passar. Para se recompor, basta o adversário ${reply}.`], variant);
      }
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

function pieceHint(puzzle: ResolvedPuzzle, move: Move): CoachMessage {
  const idea = themeHint(puzzle, THEME_HINTS);
  const lead = `Dica: quem joga agora é ${the(movePiece(move))} em ${squareName(moveFrom(move))}.`;
  return { mood: "thinking", text: idea ? `${lead} ${idea}` : puzzle.shape.kind === "mate" ? `${lead} Procure um xeque.` : lead };
}

function moveHint(position: Position, move: Move): CoachMessage {
  const facts = moveFacts(position, move);
  const played = `O lance era ${phrase(facts, "infinitive")}${tail(facts, "infinitive")}.`;
  // A mate explains itself.
  return { mood: "thinking", text: facts.mate ? played : `${played} Repare por que ele funciona.` };
}

function reveal(puzzle: ResolvedPuzzle, from = 0): CoachMessage {
  const position = positionAfter(puzzle, puzzle.line.slice(0, from));
  const steps: string[] = [];
  for (let index = from; index < puzzle.line.length; index++) {
    const move = puzzle.line[index];
    // Even half-moves are the solver's. The first one told has no move before it in this message.
    const who = index % 2 === 0 ? "Você" : "O adversário";
    steps.push(`${who} ${describeMove(position, move, "present", index > from ? puzzle.line[index - 1] : undefined)}.`);
    position.make(move);
  }
  return { mood: "calm", text: `${from === 0 ? "Veja a solução." : "Veja o resto da solução."} ${steps.join(" ")}` };
}

export const COACH_PT_BR: Coach = {
  language: "pt-br",
  text: {
    name: "Sofia",
    role: "Treinadora",
    thinking: "Sofia está pensando",
    undone: "Lance desfeito. É a sua vez.",
    reset: "Voltamos ao começo do problema. O relógio continua correndo.",
    takeBack: "Toque no tabuleiro para voltar o lance.",
    resumed: "Você parou aqui. É a sua vez.",
    revealed: "Solução revelada. Estude a ideia e tente o próximo.",
    solvedBefore: "Este problema já foi resolvido.",
  },
  describeMove,
  intro,
  praise,
  solved,
  wrong,
  pieceHint,
  moveHint,
  takeBackHint: () => ({ mood: "thinking", text: "Voltei o seu lance: ele não resolve. Tente outro caminho, ou peça outra dica." }),
  illegal(reason, piece, square) {
    if (reason === "in-check") return "Seu rei está em xeque. O lance precisa tirar o rei do xeque.";
    if (reason === "exposes-king") return "Esse lance deixaria o seu rei em xeque.";
    return `${capital(the(piece))} não pode ir para ${squareName(square)}.`;
  },
  reveal,
};
