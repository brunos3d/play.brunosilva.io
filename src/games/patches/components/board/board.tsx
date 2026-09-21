"use client";

import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DragExtent, extendExtentWithin, extentRect, startExtent } from "../../engine/board/drag";
import { cellKey, unionRect } from "../../engine/board/geometry";
import { describeClue } from "../../engine/clues/clue";
import type { Hint } from "../../engine/hints/hint";
import { regionRect } from "../../engine/regions/region";
import type { CellCoordinate, PuzzleShape, Rect, Region } from "../../engine/types";
import { isTakenByOthers } from "../../engine/validation/extendable";
import { ClueBadge } from "./clue-badge";
import type { PatchColor } from "./palette";

export type PreviewStatus = "valid" | "pending" | "invalid";

type BoardProps = {
  puzzle: PuzzleShape;
  regions: readonly Region[];
  colors: ReadonlyMap<string, PatchColor>;
  hint: Hint | null;
  /** No input is accepted: the puzzle is solved or a dialog owns the screen. */
  locked: boolean;
  solved: boolean;
  /** Changes whenever an illegal patch was refused. Triggers the shake. */
  shakeSignal: number;
  /** Patches that are on the board but not legal yet. They are drawn as unfinished and show how many cells they have. */
  pendingIds?: ReadonlySet<string>;
  /** Regions the game placed itself, by a hint or a reveal. They appear cell by cell from the clue outward. */
  tweenIds?: ReadonlySet<string>;
  /** Development only: outlines of the stored solution. */
  debugSolution?: readonly Region[] | null;
  label: string;
  previewStatus: (rect: Rect) => PreviewStatus;
  onPlace: (rect: Rect) => void;
  onRemove: (cell: CellCoordinate) => void;
  /** The player tried to draw from a cell without a clue. */
  onMisstart?: () => void;
  /** First touch of the board. The game starts its timer here. */
  onInteract?: () => void;
};

/**
 * A pointer gesture. Drawing starts on a clue cell, or on any cell of a patch
 * that is already there, and paints outward (see engine/board/drag.ts). A
 * stroke adds to the clue's patch, so a patch can be drawn in several strokes.
 * A press anywhere else can only become a tap.
 */
type Gesture =
  | { kind: "draw"; clueId: string; extent: DragExtent; moved: boolean; outside: boolean }
  | { kind: "tap"; cell: CellCoordinate; moved: boolean };

type Leaving = { key: string; region: Region };

const SHAKE_MS = 300;
/** Delay between two rings of cells when the game places a patch itself. */
const TWEEN_RING_MS = 55;
/** Releasing farther than this many cells outside the board cancels the drag. */
const CANCEL_MARGIN_CELLS = 0.6;

function percentBox(rect: Rect, puzzle: PuzzleShape): CSSProperties {
  return {
    left: `${(rect.column / puzzle.width) * 100}%`,
    top: `${(rect.row / puzzle.height) * 100}%`,
    width: `${(rect.width / puzzle.width) * 100}%`,
    height: `${(rect.height / puzzle.height) * 100}%`,
  };
}

const sameCell = (a: CellCoordinate, b: CellCoordinate): boolean => a.row === b.row && a.column === b.column;
const rectSignature = (region: Region): string => region.cells.map(cellKey).join("|");

export function Board({
  puzzle,
  regions,
  colors,
  hint,
  locked,
  solved,
  shakeSignal,
  pendingIds,
  tweenIds,
  debugSolution,
  label,
  previewStatus,
  onPlace,
  onRemove,
  onMisstart,
  onInteract,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  // The grid's box, measured once per drag. Reading it on every pointermove forces a layout pass
  // each time. The board cannot move during a drag: touch-action is none and the status line has a fixed height.
  const dragBoxRef = useRef<DOMRect | null>(null);
  // The ref is the source of truth for handlers. React batches pointermove updates, so two quick
  // moves can run before a render: reading the gesture from state would make the second move start
  // from a stale extent and drop what the first one added. State only drives what is drawn.
  const gestureRef = useRef<Gesture | null>(null);
  const [gesture, setGestureState] = useState<Gesture | null>(null);
  const setGesture = useCallback((next: Gesture | null) => {
    gestureRef.current = next;
    setGestureState(next);
  }, []);
  const [cursor, setCursor] = useState<CellCoordinate>({ row: 0, column: 0 });
  const [keyboardExtent, setKeyboardExtent] = useState<DragExtent | null>(null);
  const [keyboardClueId, setKeyboardClueId] = useState<string | null>(null);
  const [keyboardActive, setKeyboardActive] = useState(false);

  // Patches that just left the board stay mounted long enough to animate out.
  const [previousRegions, setPreviousRegions] = useState(regions);
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  const [leavingSerial, setLeavingSerial] = useState(0);
  if (previousRegions !== regions) {
    const stillThere = new Set(regions.map((region) => `${region.id}:${rectSignature(region)}`));
    const gone = previousRegions.filter((region) => !stillThere.has(`${region.id}:${rectSignature(region)}`));
    setPreviousRegions(regions);
    if (gone.length > 0) {
      setLeaving((list) => [...list, ...gone.map((region, index) => ({ key: `${region.id}:${leavingSerial + index}`, region }))]);
      setLeavingSerial((serial) => serial + gone.length);
    }
  }

  /** The rectangle a stroke stands for: what was painted, together with the patch the clue already has. */
  const withOwnPatch = (clueId: string, rect: Rect): Rect => {
    const own = regions.find((region) => region.clueId === clueId);
    return own ? unionRect(regionRect(own), rect) : rect;
  };
  /** A stroke may wander over another clue or patch. The rectangle stops at their edge and never covers them. */
  const grow = (clueId: string, extent: DragExtent, cell: CellCoordinate): DragExtent =>
    extendExtentWithin(extent, cell, (rect) => !isTakenByOthers(puzzle, regions, clueId, withOwnPatch(clueId, rect)));

  const clueByCell = useMemo(() => new Map(puzzle.clues.map((clue) => [cellKey(clue), clue])), [puzzle.clues]);
  const regionByCell = useMemo(() => {
    const map = new Map<string, Region>();
    for (const region of regions) for (const cell of region.cells) map.set(cellKey(cell), region);
    return map;
  }, [regions]);
  const regionByClue = useMemo(() => new Map(regions.map((region) => [region.clueId, region])), [regions]);

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

  useEffect(() => {
    if (!keyboardActive) return;
    cellRefs.current.get(cellKey(cursor))?.focus({ preventScroll: true });
  }, [cursor, keyboardActive]);

  // Escape abandons a pointer drag, the same as releasing outside the board.
  const drawing = gesture?.kind === "draw";
  useEffect(() => {
    if (!drawing) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setGesture(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, setGesture]);

  /** Maps a pointer position to a cell. `outside` is true once the pointer is clearly off the grid. */
  const locate = useCallback(
    (clientX: number, clientY: number): { cell: CellCoordinate; outside: boolean } | null => {
      const box = dragBoxRef.current ?? gridRef.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return null;
      const columnFloat = ((clientX - box.left) / box.width) * puzzle.width;
      const rowFloat = ((clientY - box.top) / box.height) * puzzle.height;
      const outside =
        columnFloat < -CANCEL_MARGIN_CELLS ||
        rowFloat < -CANCEL_MARGIN_CELLS ||
        columnFloat > puzzle.width + CANCEL_MARGIN_CELLS ||
        rowFloat > puzzle.height + CANCEL_MARGIN_CELLS;
      return {
        outside,
        cell: {
          row: Math.min(puzzle.height - 1, Math.max(0, Math.floor(rowFloat))),
          column: Math.min(puzzle.width - 1, Math.max(0, Math.floor(columnFloat))),
        },
      };
    },
    [puzzle.height, puzzle.width],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (locked || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    // Measure before locating the press. A drag cancelled with Escape can leave an old box behind,
    // and the window may have been resized since.
    dragBoxRef.current = gridRef.current?.getBoundingClientRect() ?? null;
    const located = locate(event.clientX, event.clientY);
    if (!located) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a convenience. Without it the drag still works while the pointer stays over the board.
    }
    onInteract?.();
    setKeyboardActive(false);
    setKeyboardExtent(null);
    setCursor(located.cell);
    const clueId = clueByCell.get(cellKey(located.cell))?.id ?? regionByCell.get(cellKey(located.cell))?.clueId;
    setGesture(clueId ? { kind: "draw", clueId, extent: startExtent(located.cell), moved: false, outside: false } : { kind: "tap", cell: located.cell, moved: false });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gestureRef.current;
    if (!current || !event.isPrimary) return;
    // Browsers merge fast moves into one event. The merged points are still part of the path the
    // player painted, so a quick flick up and back down keeps the rows it reached.
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = coalesced.length > 0 ? coalesced : [event.nativeEvent];

    if (current.kind === "tap") {
      const left = points.some((point) => {
        const located = locate(point.clientX, point.clientY);
        return located !== null && !sameCell(located.cell, current.cell);
      });
      if (left && !current.moved) setGesture({ ...current, moved: true });
      return;
    }

    let { extent, moved, outside } = current;
    for (const point of points) {
      const located = locate(point.clientX, point.clientY);
      if (!located) continue;
      outside = located.outside;
      if (!located.outside) extent = grow(current.clueId, extent, located.cell);
      moved = moved || !sameCell(located.cell, extent.anchor);
    }
    if (extent !== current.extent || moved !== current.moved || outside !== current.outside) {
      setGesture({ ...current, extent, moved, outside });
    }
  };

  const finishGesture = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    const gesture = gestureRef.current;
    if (!gesture || !event.isPrimary) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragBoxRef.current = null;
    setGesture(null);
    if (!commit || locked) return;

    if (gesture.kind === "tap") {
      // Off-clue presses never draw. A still tap removes the patch under it, a drag attempt gets a nudge.
      if (!gesture.moved && regionByCell.has(cellKey(gesture.cell))) onRemove(gesture.cell);
      else if (gesture.moved) onMisstart?.();
      return;
    }
    if (gesture.outside) return;
    if (!gesture.moved) {
      // A tap on a clue: remove its patch if it has one. Only an explicit "1" clue is drawn by a tap.
      const anchor = gesture.extent.anchor;
      if (regionByCell.has(cellKey(anchor))) onRemove(anchor);
      else if (clueByCell.get(cellKey(anchor))?.area === 1) onPlace(extentRect(gesture.extent));
      return;
    }
    onPlace(withOwnPatch(gesture.clueId, extentRect(gesture.extent)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked || event.metaKey || event.ctrlKey || event.altKey) return;
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

    if (event.key in moves) {
      event.preventDefault();
      const [rowStep, columnStep] = moves[event.key];
      const next = {
        row: Math.min(puzzle.height - 1, Math.max(0, cursor.row + rowStep)),
        column: Math.min(puzzle.width - 1, Math.max(0, cursor.column + columnStep)),
      };
      setKeyboardActive(true);
      setCursor(next);
      if (keyboardExtent && keyboardClueId) setKeyboardExtent(grow(keyboardClueId, keyboardExtent, next));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onInteract?.();
      setKeyboardActive(true);
      const clueId = clueByCell.get(cellKey(cursor))?.id ?? regionByCell.get(cellKey(cursor))?.clueId;
      if (keyboardExtent && keyboardClueId) {
        const untouched = keyboardExtent.top === keyboardExtent.bottom && keyboardExtent.left === keyboardExtent.right;
        // Enter twice on a patch without moving is the keyboard's tap: it takes the patch off.
        if (untouched && regionByCell.has(cellKey(cursor))) onRemove(cursor);
        else onPlace(withOwnPatch(keyboardClueId, extentRect(keyboardExtent)));
        setKeyboardExtent(null);
      } else if (clueId) {
        setKeyboardClueId(clueId);
        setKeyboardExtent(startExtent(cursor));
      } else {
        onMisstart?.();
      }
      return;
    }
    if (event.key === "Escape" && keyboardExtent) {
      event.preventDefault();
      setKeyboardExtent(null);
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && regionByCell.has(cellKey(cursor))) {
      event.preventDefault();
      onInteract?.();
      onRemove(cursor);
    }
  };

  const activeExtent = gesture?.kind === "draw" && gesture.moved && !gesture.outside ? gesture.extent : keyboardExtent;
  const activeClueId = gesture?.kind === "draw" ? gesture.clueId : keyboardClueId;
  const drawingClue = activeExtent && activeClueId ? puzzle.clues.find((clue) => clue.id === activeClueId) : undefined;
  const previewRect = activeExtent && drawingClue ? withOwnPatch(drawingClue.id, extentRect(activeExtent)) : null;
  const previewState = previewRect ? previewStatus(previewRect) : null;
  /** How many cells, and out of how many when the clue says. Faster to read than width by height. */
  const cellCount = (area: number, clueArea: number | undefined): string => (clueArea === undefined ? String(area) : `${area}/${clueArea}`);
  const wrongRegionId = hint?.kind === "wrong-region" ? hint.regionId : null;

  // The size label sits in the corner farthest from the clue, so it never hides the clue's icon.
  const labelCorner =
    activeExtent && previewRect
      ? {
          vertical: (drawingClue?.row ?? activeExtent.anchor.row) - previewRect.row < previewRect.height / 2 ? "bottom" : "top",
          horizontal: (drawingClue?.column ?? activeExtent.anchor.column) - previewRect.column < previewRect.width / 2 ? "right" : "left",
        }
      : null;

  return (
    <div
      ref={boardRef}
      className="mg-board"
      style={{ "--cols": puzzle.width, "--rows": puzzle.height } as CSSProperties}
      data-locked={locked}
      data-solved={solved}
      data-drawing={gesture?.kind === "draw" ? "true" : undefined}
      data-testid="patches-board"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishGesture(event, true)}
      onPointerCancel={(event) => finishGesture(event, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={gridRef} className="mg-grid" role="grid" aria-label={label} aria-rowcount={puzzle.height} aria-colcount={puzzle.width} onKeyDown={handleKeyDown}>
        {Array.from({ length: puzzle.height }, (_, row) => (
          <div key={row} role="row" style={{ display: "contents" }}>
            {Array.from({ length: puzzle.width }, (_, column) => {
              const key = cellKey({ row, column });
              const clue = clueByCell.get(key);
              const region = regionByCell.get(key);
              const isCursor = cursor.row === row && cursor.column === column;
              const parts = [`Row ${row + 1}, column ${column + 1}.`];
              if (clue) parts.push(`Clue: ${describeClue(clue)}.`);
              parts.push(region ? `Inside a ${region.width} by ${region.height} patch.` : "Empty.");
              if (region && pendingIds?.has(region.id)) parts.push("This patch is unfinished.");
              if (keyboardExtent && isCursor) parts.push("Drawing. Press Enter to place, Escape to cancel.");
              return (
                <div
                  key={key}
                  ref={(element) => {
                    if (element) cellRefs.current.set(key, element);
                    else cellRefs.current.delete(key);
                  }}
                  role="gridcell"
                  className="mg-cell"
                  tabIndex={isCursor ? 0 : -1}
                  aria-label={parts.join(" ")}
                  aria-rowindex={row + 1}
                  aria-colindex={column + 1}
                  data-clue={clue ? "true" : undefined}
                  style={clue ? ({ "--patch": colors.get(clue.id)?.value } as CSSProperties) : undefined}
                  onFocus={() => setCursor({ row, column })}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mg-layer" aria-hidden="true">
        {regions.map((region, index) => {
          const tween = tweenIds?.has(region.id) ?? false;
          const clue = tween ? puzzle.clues.find((entry) => entry.id === region.clueId) : undefined;
          const ring = (cell: CellCoordinate): number => (clue ? Math.abs(cell.row - clue.row) + Math.abs(cell.column - clue.column) : 0);
          const lastRing = tween ? Math.max(...region.cells.map(ring)) : 0;
          const box = regionRect(region);
          return (
            <div
              key={`${region.id}:${rectSignature(region)}`}
              className="patches-region"
              data-testid="patches-region"
              data-tween={tween ? "true" : undefined}
              data-pending={pendingIds?.has(region.id) ? "true" : undefined}
              data-wrong={region.id === wrongRegionId ? "true" : undefined}
              data-redrawing={drawingClue && region.clueId === drawingClue.id ? "true" : undefined}
              style={{ ...percentBox(box, puzzle), "--patch": colors.get(region.clueId)?.value, "--order": index, "--fill-delay": `${(lastRing + 1) * TWEEN_RING_MS}ms` } as CSSProperties}
            >
              {tween &&
                region.cells.map((cell) => (
                  <span
                    key={cellKey(cell)}
                    className="patches-tween-cell"
                    style={
                      {
                        left: `${((cell.column - box.column) / box.width) * 100}%`,
                        top: `${((cell.row - box.row) / box.height) * 100}%`,
                        width: `${100 / box.width}%`,
                        height: `${100 / box.height}%`,
                        "--ring-delay": `${ring(cell) * TWEEN_RING_MS}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
              <div className="patches-region-fill" />
              {pendingIds?.has(region.id) &&
                (() => {
                  // The count sits in the corner farthest from the clue, so it never covers the clue's number.
                  const own = puzzle.clues.find((entry) => entry.id === region.clueId);
                  const onRight = own !== undefined && box.width > 1 && own.column - box.column >= box.width / 2;
                  const onBottom = own !== undefined && box.width === 1 && own.row - box.row >= box.height / 2;
                  return (
                    <span className="patches-pending-count" data-side={onRight ? "left" : "right"} data-edge={onBottom ? "top" : "bottom"} data-testid="patches-pending-count">
                      {cellCount(region.area, own?.area)}
                    </span>
                  );
                })()}
            </div>
          );
        })}

        {leaving.map(({ key, region }) => (
          <div
            key={key}
            className="patches-region"
            data-leaving="true"
            style={{ ...percentBox(regionRect(region), puzzle), "--patch": colors.get(region.clueId)?.value } as CSSProperties}
            onAnimationEnd={() => setLeaving((list) => list.filter((entry) => entry.key !== key))}
          >
            <div className="patches-region-fill" />
          </div>
        ))}

        {hint?.kind === "place-region" && (
          <>
            <div className="patches-hint" data-testid="patches-hint" style={percentBox(hint.rect, puzzle)}>
              <div className="patches-hint-fill" />
            </div>
            {hint.focusCell && <div className="patches-hint-cell" style={percentBox({ ...hint.focusCell, width: 1, height: 1 }, puzzle)} />}
          </>
        )}

        {previewRect && previewState && (
          <div
            className="patches-preview"
            data-status={previewState}
            data-label-v={labelCorner?.vertical}
            data-label-h={labelCorner?.horizontal}
            data-testid="patches-preview"
            style={{ ...percentBox(previewRect, puzzle), "--patch": drawingClue ? colors.get(drawingClue.id)?.value : undefined } as CSSProperties}
          >
            <div className="patches-preview-fill" />
            <span className="patches-preview-size" data-testid="patches-preview-count">
              {cellCount(previewRect.width * previewRect.height, drawingClue?.area)}
            </span>
          </div>
        )}

        {puzzle.clues.map((clue) => (
          <div key={clue.id} style={{ position: "absolute", ...percentBox({ row: clue.row, column: clue.column, width: 1, height: 1 }, puzzle) }}>
            <ClueBadge clue={clue} derivedArea={regionByClue.get(clue.id)?.area} />
          </div>
        ))}

        {debugSolution?.map((region) => (
          <div key={`debug-${region.id}`} className="patches-debug-region" style={percentBox(regionRect(region), puzzle)} />
        ))}
      </div>
    </div>
  );
}
