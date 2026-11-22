"use client";

import { type CSSProperties, type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BoardTile } from "../../engine/game/state";
import type { Merge } from "../../engine/types";
import { tileColor } from "./palette";

type BoardProps = {
  size: number;
  tiles: readonly BoardTile[];
  /** The last merge played forwards, or null after an undo or a reset. */
  lastMerge: Merge | null;
  /** The pair a hint points at. */
  hinted: Merge | null;
  locked: boolean;
  solved: boolean;
  /** More than one tile and nothing left to merge. */
  stuck: boolean;
  shakeSignal: number;
  /** The cell a refused merge was aimed at. */
  refusedCell: number | null;
  label: string;
  /** A merge attempt: the tile on `from` dropped onto `to`. The engine decides whether it is legal. */
  onMerge: (from: number, to: number) => void;
};

const SHAKE_MS = 300;
/** A press becomes a drag after the pointer travels this far, in pixels. Under it, it is a tap. */
const DRAG_THRESHOLD = 6;
/** A drag counts as a drop on the neighbour once the tile has gone this share of the way there. */
const DROP_SHARE = 0.35;
/** How long a merged-away tile takes to slide into its neighbour and fade. */
const LEAVE_MS = 180;

type Press = { cell: number; x: number; y: number; step: number; dragging: boolean; dx: number; dy: number };
type Drag = { id: number; dx: number; dy: number };

/**
 * The Sumbreak board. It shows tiles and turns pointer and key events into
 * "this tile onto that one". Whether the merge is legal is the engine's call.
 *
 * A tile can be dragged onto a neighbour, or merged with two taps: the tile to
 * move, then the tile to drop it on. The sum always lands on the second one.
 * Tiles keep their identity between positions, so a merge is one tile sliding
 * into another and the other one growing.
 */
export function SumbreakBoard({ size, tiles, lastMerge, hinted, locked, solved, stuck, shakeSignal, refusedCell, label, onMerge }: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Source of truth for the handlers. React batches pointermove updates, so state would lag behind fast input.
  const pressRef = useRef<Press | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);

  const tileAt = useMemo(() => new Map(tiles.map((tile) => [tile.cell, tile])), [tiles]);

  // Runs when the tiles change. A tile that was merged away is kept for a moment, moved onto the cell it merged into,
  // so it slides there and fades instead of vanishing. A selection never outlives the position it was made in.
  const [shown, setShown] = useState(tiles);
  const [leaving, setLeaving] = useState<BoardTile[]>([]);
  if (shown !== tiles) {
    const alive = new Set(tiles.map((tile) => tile.id));
    setLeaving(lastMerge ? shown.filter((tile) => !alive.has(tile.id) && tile.cell === lastMerge.from).map((tile) => ({ ...tile, cell: lastMerge.to })) : []);
    setShown(tiles);
    setSelected(null);
  }
  // A hint takes over the board: whatever the player had picked up is put down.
  const [seenHint, setSeenHint] = useState(hinted);
  if (seenHint !== hinted) {
    setSeenHint(hinted);
    if (hinted) setSelected(null);
  }
  useEffect(() => {
    if (leaving.length === 0) return;
    const timeout = window.setTimeout(() => setLeaving([]), LEAVE_MS);
    return () => window.clearTimeout(timeout);
  }, [leaving]);

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

  const adjacent = (a: number, b: number): boolean => (Math.abs(a - b) === size && true) || (Math.abs(a - b) === 1 && Math.floor(a / size) === Math.floor(b / size));

  /** Tap logic: the first tap picks the tile to move, the second the tile to drop it on. */
  const tap = (cell: number) => {
    setCursor(cell);
    if (selected === null) {
      if (tileAt.has(cell)) setSelected(cell);
      return;
    }
    if (cell === selected) {
      setSelected(null);
      return;
    }
    // A tap on a tile that is not a neighbour starts over from that tile. Anything else is a merge attempt, and the engine explains a refusal.
    if (tileAt.has(cell) && !adjacent(selected, cell)) {
      setSelected(cell);
      return;
    }
    setSelected(null);
    if (adjacent(selected, cell)) onMerge(selected, cell);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (locked || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    const box = gridRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const step = box.width / size;
    const column = Math.floor((event.clientX - box.left) / step);
    const row = Math.floor((event.clientY - box.top) / step);
    if (column < 0 || row < 0 || column >= size || row >= size) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a convenience. Without it the drag still works while the pointer stays over the board.
    }
    pressRef.current = { cell: row * size + column, x: event.clientX, y: event.clientY, step, dragging: false, dx: 0, dy: 0 };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    if (!press || !event.isPrimary) return;
    const tile = tileAt.get(press.cell);
    if (!tile) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    press.dragging = true;
    // A tile travels along one axis, and no further than the neighbouring cell.
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const clamp = (value: number) => Math.max(-press.step, Math.min(press.step, value));
    press.dx = horizontal ? clamp(dx) : 0;
    press.dy = horizontal ? 0 : clamp(dy);
    setDrag({ id: tile.id, dx: press.dx, dy: press.dy });
  };

  const finish = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const press = pressRef.current;
    if (!press || !event.isPrimary) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pressRef.current = null;
    setDrag(null);
    if (cancelled) return;
    if (!press.dragging) {
      tap(press.cell);
      return;
    }
    const row = Math.floor(press.cell / size);
    const column = press.cell % size;
    const far = press.step * DROP_SHARE;
    const targetColumn = column + (press.dx > far ? 1 : press.dx < -far ? -1 : 0);
    const targetRow = row + (press.dy > far ? 1 : press.dy < -far ? -1 : 0);
    if (targetColumn === column && targetRow === row) return;
    setSelected(null);
    if (targetColumn < 0 || targetRow < 0 || targetColumn >= size || targetRow >= size) return;
    onMerge(press.cell, targetRow * size + targetColumn);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      const row = Math.min(size - 1, Math.max(0, Math.floor(cursor / size) + step[0]));
      const column = Math.min(size - 1, Math.max(0, (cursor % size) + step[1]));
      setCursor(row * size + column);
      return;
    }
    if (event.key === "Escape" && selected !== null) {
      event.preventDefault();
      setSelected(null);
      return;
    }
    if (locked || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    tap(cursor);
  };

  const position = (cell: number, offset?: Drag): CSSProperties => ({
    transform: `translate(calc(${(cell % size) * 100}% + ${offset?.dx ?? 0}px), calc(${Math.floor(cell / size) * 100}% + ${offset?.dy ?? 0}px))`,
  });
  const selectedValue = selected !== null ? tileAt.get(selected)?.value : undefined;

  return (
    <div
      ref={boardRef}
      className="mg-board sumbreak-board"
      style={{ "--cols": size, "--rows": size } as CSSProperties}
      data-locked={locked}
      data-solved={solved}
      data-stuck={stuck}
      data-dragging={drag !== null}
      data-testid="sumbreak-board"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finish(event, false)}
      onPointerCancel={(event) => finish(event, true)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={gridRef} className="mg-grid" role="grid" tabIndex={0} aria-label={label} aria-rowcount={size} aria-colcount={size} aria-activedescendant={`sumbreak-cell-${cursor}`} onKeyDown={handleKeyDown}>
        {Array.from({ length: size }, (_, row) => (
          <div key={row} role="row" style={{ display: "contents" }}>
            {Array.from({ length: size }, (_, column) => {
              const cell = row * size + column;
              const tile = tileAt.get(cell);
              const parts = [`Row ${row + 1}, column ${column + 1}.`, tile ? `${tile.value}.` : "Empty."];
              if (cell === selected) parts.push("Picked up.");
              const partner = selected !== null && cell !== selected && tile?.value === selectedValue && adjacent(selected, cell);
              if (partner) parts.push("Can take the tile you picked up.");
              return (
                <div
                  key={cell}
                  id={`sumbreak-cell-${cell}`}
                  role="gridcell"
                  className="mg-cell sumbreak-cell"
                  aria-label={parts.join(" ")}
                  aria-rowindex={row + 1}
                  aria-colindex={column + 1}
                  aria-selected={cell === selected}
                  data-empty={tile ? undefined : "true"}
                  data-refused={cell === refusedCell ? "true" : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mg-layer sumbreak-tiles" aria-hidden="true">
        {leaving.map((tile) => (
          <div key={tile.id} className="sumbreak-tile" data-leaving="true" style={position(tile.cell)}>
            <div className="sumbreak-face" style={{ "--tile-color": tileColor(tile.value) } as CSSProperties}>
              <span data-digits={String(tile.value).length}>{tile.value}</span>
            </div>
          </div>
        ))}
        {tiles.map((tile) => {
          const lifted = drag?.id === tile.id;
          const partner = selected !== null && tile.cell !== selected && tile.value === selectedValue && adjacent(selected, tile.cell);
          return (
            <div
              key={tile.id}
              className="sumbreak-tile"
              data-testid="sumbreak-tile"
              data-cell={tile.cell}
              data-value={tile.value}
              data-lifted={lifted ? "true" : undefined}
              data-selected={tile.cell === selected ? "true" : undefined}
              data-partner={partner ? "true" : undefined}
              data-hint={hinted && (tile.cell === hinted.from || tile.cell === hinted.to) ? (tile.cell === hinted.from ? "from" : "to") : undefined}
              data-refused={tile.cell === refusedCell ? "true" : undefined}
              style={position(tile.cell, lifted ? drag : undefined)}
            >
              {/* Keyed by value: a tile that just grew is a new face, which replays the pop. */}
              <div key={tile.value} className="sumbreak-face" style={{ "--tile-color": tileColor(tile.value) } as CSSProperties}>
                <span data-digits={String(tile.value).length}>{tile.value}</span>
              </div>
            </div>
          );
        })}
        <div className="sumbreak-cursor" style={position(cursor)} />
      </div>
    </div>
  );
}
