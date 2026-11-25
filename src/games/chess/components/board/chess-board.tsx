"use client";

import { useTranslations } from "next-intl";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BISHOP, type Color, KNIGHT, QUEEN, ROOK, WHITE, squareName } from "../../engine/position";
import type { BoardPiece, BoardView } from "../../engine/puzzle";
import type { MoveTarget } from "../../hooks/use-chess-game";
import { ChessPiece } from "./pieces";

type BoardProps = {
  view: BoardView;
  /** The colour at the bottom of the board: the side the player moves. */
  orientation: Color;
  /** Where each of the player's pieces may go. Empty while the board takes no moves. */
  targets: ReadonlyMap<number, readonly MoveTarget[]>;
  /** No input at all: loading, solved, or the game is moving pieces itself. */
  locked: boolean;
  /** A wrong move is on the board. Any press takes it back. */
  awaitingTakeBack: boolean;
  /** Square a hint points at. */
  hintSquare: number | null;
  /** The coach's mark on the last judged move. */
  verdict: { square: number; good: boolean } | null;
  shakeSignal: number;
  label: string;
  /** A move attempt. The engine decides whether it is legal. `promotion` is a piece type, or 0. */
  onMove: (from: number, to: number, promotion: number) => void;
  onTakeBack: () => void;
};

const SHAKE_MS = 300;
/** A press turns into a drag after the pointer travels this far, in pixels. Under it, it is a tap that selects. */
const DRAG_THRESHOLD = 5;
/** How long a captured piece takes to fade, and how long a dropped piece skips its slide. */
const EXIT_MS = 200;
const PROMOTION_CHOICES = [QUEEN, KNIGHT, ROOK, BISHOP] as const;

/** Message keys of the pieces, indexed by piece type. Screen readers hear them in the interface locale. */
const PIECE_KEYS = ["", "pawn", "knight", "bishop", "rook", "queen", "king"] as const;

type Press = { square: number; x: number; y: number; dragging: boolean; wasSelected: boolean; touch: boolean };
type Drag = { piece: BoardPiece; size: number; x: number; y: number; touch: boolean };

/**
 * The chess board. It only knows how to show a position and turn pointer and
 * key events into "from this square to that one". Whether a move is legal,
 * right or wrong is the engine's call.
 *
 * Pieces can be dragged, or moved with two taps: one on the piece, one on the
 * square. Pieces keep their identity between positions, so a move is the same
 * element sliding to a new place, forwards and backwards alike.
 */
export function ChessBoard({ view, orientation, targets, locked, awaitingTakeBack, hintSquare, verdict, shakeSignal, label, onMove, onTakeBack }: BoardProps) {
  const t = useTranslations("chess");
  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  // Source of truth for the handlers. React batches pointermove updates, so state would lag behind fast input.
  const pressRef = useRef<Press | null>(null);
  const boxRef = useRef<DOMRect | null>(null);
  const hoverRef = useRef(-1);

  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState(orientation === WHITE ? 12 : 52);
  const [hover, setHover] = useState(-1);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [promotion, setPromotion] = useState<{ from: number; to: number } | null>(null);
  /** The piece that was just dropped by hand. It is already where it belongs, so it must not slide there again. */
  const [droppedId, setDroppedId] = useState<number | null>(null);

  const pieceAt = useMemo(() => new Map(view.pieces.map((piece) => [piece.square, piece])), [view.pieces]);

  // Runs when the position changes. Captured pieces are kept for a moment so they fade out instead of vanishing
  // under the piece that takes them, and a selection never outlives the position it was made in.
  const [shown, setShown] = useState(view.pieces);
  const [exiting, setExiting] = useState<BoardPiece[]>([]);
  if (shown !== view.pieces) {
    const alive = new Set(view.pieces.map((piece) => piece.id));
    setExiting(shown.filter((piece) => !alive.has(piece.id)));
    setShown(view.pieces);
    setSelected(null);
    setPromotion(null);
  }
  useEffect(() => {
    if (exiting.length === 0) return;
    const timeout = window.setTimeout(() => setExiting([]), EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [exiting]);

  useEffect(() => {
    if (droppedId === null) return;
    const timeout = window.setTimeout(() => setDroppedId(null), EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [droppedId]);

  useEffect(() => {
    if (shakeSignal === 0) return;
    const board = boardRef.current;
    if (!board) return;
    board.dataset.shake = "false";
    void board.offsetWidth; // restart the animation when two refusals come back to back
    board.dataset.shake = "true";
    const timeout = window.setTimeout(() => {
      board.dataset.shake = "false";
    }, SHAKE_MS);
    return () => window.clearTimeout(timeout);
  }, [shakeSignal]);

  const place = (square: number): { row: number; column: number } => (orientation === WHITE ? { row: 7 - (square >> 3), column: square & 7 } : { row: square >> 3, column: 7 - (square & 7) });
  const squareAt = useCallback((row: number, column: number): number => (orientation === WHITE ? (7 - row) * 8 + column : row * 8 + (7 - column)), [orientation]);

  const squareFromPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const box = boxRef.current ?? gridRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return null;
      const column = Math.floor(((clientX - box.left) / box.width) * 8);
      const row = Math.floor(((clientY - box.top) / box.height) * 8);
      if (column < 0 || row < 0 || column > 7 || row > 7) return null;
      return squareAt(row, column);
    },
    [squareAt],
  );

  const isMine = (square: number): boolean => pieceAt.get(square)?.color === orientation;

  /** Sends a move attempt to the engine, or opens the promotion choice first. */
  const commit = (from: number, to: number, byDrag: boolean) => {
    const target = targets.get(from)?.find((entry) => entry.to === to);
    setSelected(null);
    if (target?.promotion) {
      setPromotion({ from, to });
      return;
    }
    if (byDrag && target) setDroppedId(pieceAt.get(from)?.id ?? null);
    onMove(from, to, 0);
  };

  const moveGhost = (clientX: number, clientY: number, size: number, touch: boolean) => {
    const ghost = ghostRef.current;
    // On a touch screen the piece rides above the finger, or the finger would hide it.
    if (ghost) ghost.style.transform = `translate3d(${clientX - size / 2}px, ${clientY - size / 2 - (touch ? size * 0.55 : 0)}px, 0)`;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (promotion) {
      setPromotion(null);
      return;
    }
    if (awaitingTakeBack) {
      event.preventDefault();
      onTakeBack();
      return;
    }
    if (locked) return;
    // Measure before locating the press, so a stale box can never decide which square was hit.
    boxRef.current = gridRef.current?.getBoundingClientRect() ?? null;
    const square = squareFromPoint(event.clientX, event.clientY);
    if (square === null) return;
    event.preventDefault();
    setCursor(square);

    if (isMine(square)) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a convenience. Without it the drag still works while the pointer stays over the board.
      }
      pressRef.current = { square, x: event.clientX, y: event.clientY, dragging: false, wasSelected: selected === square, touch: event.pointerType !== "mouse" };
      setSelected(square);
      return;
    }
    if (selected !== null) commit(selected, square, false);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    if (!press || !event.isPrimary) return;
    const box = boxRef.current;
    if (!box) return;
    const size = box.width / 8;
    if (!press.dragging) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
      const piece = pieceAt.get(press.square);
      if (!piece) return;
      press.dragging = true;
      setDrag({ piece, size, x: event.clientX, y: event.clientY, touch: press.touch });
    }
    moveGhost(event.clientX, event.clientY, size, press.touch);
    const over = squareFromPoint(event.clientX, event.clientY) ?? -1;
    if (over !== hoverRef.current) {
      hoverRef.current = over;
      setHover(over);
    }
  };

  const finish = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const press = pressRef.current;
    if (!press || !event.isPrimary) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pressRef.current = null;
    hoverRef.current = -1;
    setHover(-1);
    setDrag(null);
    if (press.dragging) {
      const square = cancelled ? null : squareFromPoint(event.clientX, event.clientY);
      // Dropped back on its own square or outside the board: the piece returns and stays selected.
      if (square !== null && square !== press.square) commit(press.square, square, true);
    } else if (press.wasSelected) {
      setSelected(null);
    }
    boxRef.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      const { row, column } = place(cursor);
      setCursor(squareAt(Math.min(7, Math.max(0, row + step[0])), Math.min(7, Math.max(0, column + step[1]))));
      return;
    }
    if (event.key === "Escape" && (selected !== null || promotion)) {
      event.preventDefault();
      setSelected(null);
      setPromotion(null);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (awaitingTakeBack) {
      onTakeBack();
      return;
    }
    if (locked) return;
    if (isMine(cursor)) setSelected(selected === cursor ? null : cursor);
    else if (selected !== null) commit(selected, cursor, false);
  };

  const choosePromotion = (type: number) => {
    if (!promotion) return;
    setPromotion(null);
    onMove(promotion.from, promotion.to, type);
  };

  const shownTargets = selected !== null ? (targets.get(selected) ?? []) : [];
  const targetAt = new Map(shownTargets.map((target) => [target.to, target]));
  const lastMove = view.lastMove;
  const translate = (square: number): CSSProperties => {
    const { row, column } = place(square);
    return { transform: `translate(${column * 100}%, ${row * 100}%)` };
  };

  return (
    <div
      ref={boardRef}
      className="mg-board chess-board"
      style={{ "--cols": 8, "--rows": 8 } as CSSProperties}
      data-locked={locked}
      data-dragging={drag !== null}
      data-take-back={awaitingTakeBack}
      data-turn={view.turn === WHITE ? "white" : "black"}
      data-testid="chess-board"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finish(event, false)}
      onPointerCancel={(event) => finish(event, true)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={gridRef} className="mg-grid" role="grid" tabIndex={0} aria-label={label} aria-rowcount={8} aria-colcount={8} aria-activedescendant={`chess-square-${cursor}`} onKeyDown={handleKeyDown}>
        {Array.from({ length: 8 }, (_, row) => (
          <div key={row} role="row" style={{ display: "contents" }}>
            {Array.from({ length: 8 }, (_, column) => {
              const square = squareAt(row, column);
              const piece = pieceAt.get(square);
              const target = targetAt.get(square);
              const dark = ((square & 7) + (square >> 3)) % 2 === 0;
              const parts = [squareName(square), piece ? t(`board.piece.${piece.color === WHITE ? "white" : "black"}.${PIECE_KEYS[piece.type]}`) : t("board.empty")];
              if (square === selected) parts.push(t("board.selected"));
              if (target) parts.push(t(target.capture ? "board.canCapture" : "board.canMove"));
              if (square === view.checkSquare) parts.push(t(view.checkmate ? "board.checkmate" : "board.inCheck"));
              return (
                <div
                  key={square}
                  id={`chess-square-${square}`}
                  role="gridcell"
                  className="mg-cell chess-square"
                  aria-label={parts.join(", ")}
                  aria-rowindex={row + 1}
                  aria-colindex={column + 1}
                  aria-selected={square === selected}
                  data-square={squareName(square)}
                  data-dark={dark}
                  data-last={lastMove !== null && (square === lastMove[0] || square === lastMove[1]) ? "true" : undefined}
                  data-selected={square === selected ? "true" : undefined}
                  data-check={square === view.checkSquare ? "true" : undefined}
                  data-hint={square === hintSquare ? "true" : undefined}
                  data-hover={square === hover && drag !== null ? "true" : undefined}
                  data-cursor={square === cursor ? "true" : undefined}
                  data-mine={piece?.color === orientation ? "true" : undefined}
                >
                  {column === 0 && <span className="chess-coordinate" data-edge="rank">{(square >> 3) + 1}</span>}
                  {row === 7 && <span className="chess-coordinate" data-edge="file">{"abcdefgh"[square & 7]}</span>}
                  {target && <span className="chess-target" data-capture={target.capture} data-testid="chess-target" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mg-layer chess-pieces" aria-hidden="true">
        {exiting.map((piece) => (
          <div key={`gone-${piece.id}`} className="chess-piece" data-exiting="true" style={translate(piece.square)}>
            <ChessPiece type={piece.type} color={piece.color} />
          </div>
        ))}
        {view.pieces.map((piece) => (
          <div
            key={piece.id}
            className="chess-piece"
            data-testid="chess-piece"
            data-square={squareName(piece.square)}
            data-piece={`${piece.color === WHITE ? "w" : "b"}${piece.type}`}
            data-instant={piece.id === droppedId ? "true" : undefined}
            data-lifted={drag?.piece.id === piece.id ? "true" : undefined}
            data-moved={lastMove !== null && piece.square === lastMove[1] ? "true" : undefined}
            style={translate(piece.square)}
          >
            <ChessPiece type={piece.type} color={piece.color} />
          </div>
        ))}
        {verdict && (
          <div className="chess-verdict" data-good={verdict.good} data-testid="chess-verdict" style={translate(verdict.square)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
              {verdict.good ? <path d="m6 12.5 4 4 8-9" /> : <path d="M7 7l10 10M17 7 7 17" />}
            </svg>
          </div>
        )}
      </div>

      {promotion && (
        <div className="mg-layer chess-promotion-layer">
          <div className="chess-promotion" role="group" aria-label={t("promotion.label")} style={{ transform: `translate(${place(promotion.to).column * 100}%, 0)` }} onPointerDown={(event) => event.stopPropagation()}>
            {PROMOTION_CHOICES.map((type) => (
              <button key={type} type="button" aria-label={t(`promotion.${PIECE_KEYS[type]}`)} data-testid={`chess-promote-${type}`} onClick={() => choosePromotion(type)}>
                <ChessPiece type={type} color={orientation} />
              </button>
            ))}
          </div>
        </div>
      )}

      {drag &&
        createPortal(
          <div
            ref={ghostRef}
            className="chess-ghost"
            data-touch={drag.touch}
            style={{ width: drag.size, height: drag.size, transform: `translate3d(${drag.x - drag.size / 2}px, ${drag.y - drag.size / 2 - (drag.touch ? drag.size * 0.55 : 0)}px, 0)` }}
            aria-hidden="true"
          >
            <ChessPiece type={drag.piece.type} color={drag.piece.color} />
          </div>,
          document.body,
        )}
    </div>
  );
}
