import type { Rng } from "@/shared/engine/prng";

/**
 * How the solved board looks. `random` is pure noise. The others start from a
 * recognisable drawing and are only lightly disturbed, so the finished path
 * still reads as a spiral, a meander or a space-filling curve.
 */
export const PATH_STYLES = ["random", "spiral", "snake", "hilbert", "hugging"] as const;
export type PathStyle = (typeof PATH_STYLES)[number];

const snake = (size: number): number[] => {
  const path: number[] = [];
  for (let row = 0; row < size; row++) for (let step = 0; step < size; step++) path.push(row * size + (row % 2 === 0 ? step : size - 1 - step));
  return path;
};

const spiral = (size: number): number[] => {
  const path: number[] = [];
  let [top, left, bottom, right] = [0, 0, size - 1, size - 1];
  while (top <= bottom && left <= right) {
    for (let column = left; column <= right; column++) path.push(top * size + column);
    for (let row = top + 1; row <= bottom; row++) path.push(row * size + right);
    if (top < bottom) for (let column = right - 1; column >= left; column--) path.push(bottom * size + column);
    if (left < right) for (let row = bottom - 1; row > top; row--) path.push(row * size + left);
    top++;
    left++;
    bottom--;
    right--;
  }
  return path;
};

/**
 * Generalised Hilbert curve ("gilbert") for any rectangle. On some odd sizes it
 * contains one diagonal step, which is not a legal move here, so callers check
 * the result with `isHamiltonianPath` and fall back to another style.
 */
const hilbert = (size: number): number[] => {
  const path: number[] = [];
  const walk = (x: number, y: number, ax: number, ay: number, bx: number, by: number): void => {
    const width = Math.abs(ax + ay);
    const height = Math.abs(bx + by);
    const [dax, day, dbx, dby] = [Math.sign(ax), Math.sign(ay), Math.sign(bx), Math.sign(by)];
    if (height === 1 || width === 1) {
      const [count, stepX, stepY] = height === 1 ? [width, dax, day] : [height, dbx, dby];
      for (let i = 0; i < count; i++) path.push((y + i * stepY) * size + x + i * stepX);
      return;
    }
    let [ax2, ay2, bx2, by2] = [Math.floor(ax / 2), Math.floor(ay / 2), Math.floor(bx / 2), Math.floor(by / 2)];
    if (2 * width > 3 * height) {
      if (Math.abs(ax2 + ay2) % 2 !== 0 && width > 2) [ax2, ay2] = [ax2 + dax, ay2 + day];
      walk(x, y, ax2, ay2, bx, by);
      walk(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by);
      return;
    }
    if (Math.abs(bx2 + by2) % 2 !== 0 && height > 2) [bx2, by2] = [bx2 + dbx, by2 + dby];
    walk(x, y, bx2, by2, ax2, ay2);
    walk(x + bx2, y + by2, ax, ay, bx - bx2, by - by2);
    walk(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby), -bx2, -by2, -(ax - ax2), -(ay - ay2));
  };
  walk(0, 0, size, 0, 0, size);
  return path;
};

export function isHamiltonianPath(path: readonly number[], neighbors: readonly (readonly number[])[]): boolean {
  if (path.length !== neighbors.length || new Set(path).size !== path.length) return false;
  for (let i = 1; i < path.length; i++) if (!neighbors[path[i - 1]].includes(path[i])) return false;
  return true;
}

/** One of the eight symmetries of the square, plus walking the path backwards, so a style never looks the same twice. */
function randomSymmetry(rng: Rng, path: number[], size: number): number[] {
  const [transpose, flipRows, flipColumns, reverse] = [rng.chance(0.5), rng.chance(0.5), rng.chance(0.5), rng.chance(0.5)];
  const moved = path.map((cell) => {
    let [row, column] = [Math.floor(cell / size), cell % size];
    if (transpose) [row, column] = [column, row];
    if (flipRows) row = size - 1 - row;
    if (flipColumns) column = size - 1 - column;
    return row * size + column;
  });
  return reverse ? moved.reverse() : moved;
}

/** The undisturbed drawing of a style on an open board, or null when the style does not fit this size. */
export function basePath(rng: Rng, style: Exclude<PathStyle, "hugging">, size: number, neighbors: readonly (readonly number[])[]): number[] | null {
  const drawn = style === "spiral" ? spiral(size) : style === "hilbert" ? hilbert(size) : snake(size);
  const path = randomSymmetry(rng, drawn, size);
  return isHamiltonianPath(path, neighbors) ? path : null;
}

/**
 * Backbiting on any graph. Pick an end of the path and a graph neighbour of it
 * that is not its path neighbour, then reverse the stretch between them. The
 * result is again a Hamiltonian path of the same graph, so walls are respected.
 * Each move changes exactly one edge of the drawing, which makes `moves` a dial
 * from "the drawing, slightly off" to "noise".
 */
export function backbite(rng: Rng, start: readonly number[], neighbors: readonly (readonly number[])[], moves: number): number[] {
  const path = [...start];
  const position = new Int32Array(path.length);
  path.forEach((cell, index) => (position[cell] = index));
  const reverse = (from: number, to: number): void => {
    for (let i = from, j = to; i < j; i++, j--) {
      [path[i], path[j]] = [path[j], path[i]];
      position[path[i]] = i;
      position[path[j]] = j;
    }
  };
  for (let move = 0; move < moves; move++) {
    const atTail = rng.chance(0.5);
    const endCell = atTail ? path[path.length - 1] : path[0];
    const pathNeighbor = atTail ? path[path.length - 2] : path[1];
    const options = neighbors[endCell].filter((cell) => cell !== pathNeighbor);
    if (options.length === 0) continue;
    const index = position[rng.pick(options)];
    if (atTail) reverse(index + 1, path.length - 1);
    else reverse(0, index - 1);
  }
  return path;
}

/**
 * Finds some Hamiltonian path on a walled board, or null within the budget.
 * Depth-first with fewest-exits-first ordering, which hugs walls and edges and
 * gives the "hugging" style its look. Two prunings: every unvisited cell must
 * stay reachable, and at most one of them may be a dead end (it becomes the
 * last cell).
 */
export function findHamiltonianPath(rng: Rng, neighbors: readonly (readonly number[])[], size: number, maxNodes = 30_000): number[] | null {
  const cellCount = neighbors.length;
  const visited = new Uint8Array(cellCount);
  const stamp = new Int32Array(cellCount);
  const queue = new Int32Array(cellCount);
  const path: number[] = [];
  let stampId = 0;
  let nodes = 0;

  const exits = (cell: number, head: number): number => {
    let count = 0;
    for (const other of neighbors[cell]) if (!visited[other] || other === head) count++;
    return count;
  };

  const viable = (head: number): boolean => {
    const remaining = cellCount - path.length;
    if (remaining === 0) return true;
    stampId++;
    let [tail, reached, deadEnds] = [0, 0, 0];
    for (const other of neighbors[head]) {
      if (!visited[other] && stamp[other] !== stampId) {
        stamp[other] = stampId;
        queue[tail++] = other;
      }
    }
    for (let i = 0; i < tail; i++) {
      const cell = queue[i];
      reached++;
      const free = exits(cell, head);
      if (free === 0 || (free === 1 && ++deadEnds > 1)) return false;
      for (const other of neighbors[cell]) {
        if (!visited[other] && stamp[other] !== stampId) {
          stamp[other] = stampId;
          queue[tail++] = other;
        }
      }
    }
    return reached === remaining;
  };

  const search = (head: number): boolean => {
    if (path.length === cellCount) return true;
    if (++nodes > maxNodes || !viable(head)) return false;
    const options = neighbors[head].filter((cell) => !visited[cell]).map((cell) => ({ cell, free: exits(cell, -1), tie: rng.next() }));
    options.sort((a, b) => a.free - b.free || a.tie - b.tie);
    for (const { cell } of options) {
      visited[cell] = 1;
      path.push(cell);
      if (search(cell)) return true;
      path.pop();
      visited[cell] = 0;
      if (nodes > maxNodes) return false;
    }
    return false;
  };

  // A cell with a single neighbour can only be an end of the path. More than two of them means no path exists,
  // and one or two of them decide where to start. Otherwise any cell will do, except that on an odd board a
  // Hamiltonian path must start on the majority colour of the checkerboard.
  const deadEnds = [...Array(cellCount).keys()].filter((cell) => neighbors[cell].length === 1);
  if (deadEnds.length > 2 || neighbors.some((list) => list.length === 0)) return null;
  const startable = [...Array(cellCount).keys()].filter((cell) => cellCount % 2 === 0 || (Math.floor(cell / size) + (cell % size)) % 2 === 0);
  const starts = deadEnds.length > 0 ? deadEnds : rng.shuffle(startable).slice(0, 6);
  for (const start of starts) {
    visited.fill(0);
    path.length = 0;
    nodes = 0;
    visited[start] = 1;
    path.push(start);
    if (search(start)) return [...path];
  }
  return null;
}
