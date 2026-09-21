import type { Rng } from "@/shared/engine/prng";

/**
 * How the solved board looks. `random` is pure noise. The others start from a
 * recognisable drawing and are only lightly disturbed, so the finished path
 * still reads as a spiral, a meander or a space-filling curve. `hugging` is a
 * path grown around a figure, and `symmetric` is one half of a path plus its
 * mirror image or half turn.
 */
export type DrawnStyle = Exclude<PathStyle, "hugging" | "symmetric">;
export const PATH_STYLES = ["random", "spiral", "snake", "hilbert", "hugging", "symmetric"] as const;
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

/** `count` is the number of cells to cover. It is smaller than the grid when the board has blocked cells. */
export function isHamiltonianPath(path: readonly number[], neighbors: readonly (readonly number[])[], count = neighbors.length): boolean {
  if (path.length !== count || new Set(path).size !== path.length) return false;
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
export function basePath(rng: Rng, style: DrawnStyle, size: number, neighbors: readonly (readonly number[])[]): number[] | null {
  const drawn = style === "spiral" ? spiral(size) : style === "hilbert" ? hilbert(size) : snake(size);
  const path = randomSymmetry(rng, drawn, size);
  return isHamiltonianPath(path, neighbors) ? path : null;
}

/**
 * Backbiting on any graph. Pick an end of the path and a graph neighbour of it
 * that is not its path neighbour, then reverse the stretch between them. The
 * result is again a Hamiltonian path of the same graph, so walls are respected.
 * Each move changes exactly one edge of the drawing, which makes `moves` a dial
 * from "the drawing, slightly off" to "noise". With `pinStart` only the far
 * end moves, so the first cell stays where it is.
 */
export function backbite(rng: Rng, start: readonly number[], neighbors: readonly (readonly number[])[], moves: number, pinStart = false): number[] {
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
    const atTail = rng.chance(0.5) || pinStart;
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

export type SearchOptions = {
  /** Nodes that are not part of the graph, for example blocked cells. */
  skip?: Uint8Array;
  /** The path must start on one of these. */
  starts?: readonly number[];
  maxNodes?: number;
};

/**
 * Finds some Hamiltonian path on a graph, or null within the budget. The graph
 * is a walled board, a board with blocked cells, or the quotient graph of a
 * symmetric board. Depth-first with fewest-exits-first ordering, which hugs
 * walls and edges and gives the "hugging" style its look. Two prunings: every
 * unvisited node must stay reachable, and at most one of them may be a dead end
 * (it becomes the last node).
 */
export function findHamiltonianPath(rng: Rng, neighbors: readonly (readonly number[])[], options: SearchOptions = {}): number[] | null {
  const maxNodes = options.maxNodes ?? 30_000;
  const nodeCount = neighbors.length;
  const active = [...Array(nodeCount).keys()].filter((node) => !options.skip?.[node]);
  const visited = new Uint8Array(nodeCount);
  const stamp = new Int32Array(nodeCount);
  const queue = new Int32Array(nodeCount);
  const path: number[] = [];
  let stampId = 0;
  let nodes = 0;

  const exits = (cell: number, head: number): number => {
    let count = 0;
    for (const other of neighbors[cell]) if (!visited[other] || other === head) count++;
    return count;
  };

  const viable = (head: number): boolean => {
    const remaining = active.length - path.length;
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
    if (path.length === active.length) return true;
    if (++nodes > maxNodes || !viable(head)) return false;
    const next = neighbors[head].filter((cell) => !visited[cell]).map((cell) => ({ cell, free: exits(cell, -1), tie: rng.next() }));
    next.sort((a, b) => a.free - b.free || a.tie - b.tie);
    for (const { cell } of next) {
      visited[cell] = 1;
      path.push(cell);
      if (search(cell)) return true;
      path.pop();
      visited[cell] = 0;
      if (nodes > maxNodes) return false;
    }
    return false;
  };

  // A node with a single neighbour can only be an end of the path. More than two of them means no path exists,
  // and one or two of them decide where to start.
  const deadEnds = active.filter((node) => neighbors[node].length === 1);
  if (active.length === 0 || deadEnds.length > 2 || active.some((node) => neighbors[node].length === 0 && active.length > 1)) return null;

  // A grid is a checkerboard, and a path alternates colours. When one colour has a node more, the path starts on
  // that colour, and a bigger difference means there is no path at all. Blocked cells make this matter on any size.
  const color = new Int8Array(nodeCount).fill(-1);
  let bipartite = true;
  color[active[0]] = 0;
  for (const frontier = [active[0]]; frontier.length > 0 && bipartite; ) {
    const node = frontier.pop()!;
    for (const other of neighbors[node]) {
      if (color[other] === -1) {
        color[other] = 1 - color[node];
        frontier.push(other);
      } else if (color[other] === color[node]) bipartite = false;
    }
  }
  let startable = active;
  if (bipartite) {
    const zeros = active.filter((node) => color[node] === 0).length;
    const gap = zeros - (active.length - zeros);
    if (Math.abs(gap) > 1) return null;
    if (gap !== 0) startable = active.filter((node) => color[node] === (gap > 0 ? 0 : 1));
  }

  const allowed = new Set(startable);
  const starts = options.starts ? options.starts.filter((node) => allowed.has(node)) : deadEnds.length > 0 ? deadEnds : rng.shuffle(startable).slice(0, 6);
  for (const start of starts) {
    if (deadEnds.length > 0 && !deadEnds.includes(start) && deadEnds.length === 2) continue;
    visited.fill(0);
    path.length = 0;
    nodes = 0;
    visited[start] = 1;
    path.push(start);
    if (search(start)) return [...path];
  }
  return null;
}

/** Where a symmetry sends a cell. "rotate" is a half turn. */
export function mapCell(symmetry: "mirror-x" | "mirror-y" | "rotate", size: number, cell: number): number {
  const last = size - 1;
  const [row, column] = [Math.floor(cell / size), cell % size];
  if (symmetry === "mirror-x") return row * size + (last - column);
  if (symmetry === "mirror-y") return (last - row) * size + column;
  return (last - row) * size + (last - column);
}

/**
 * A Hamiltonian path that maps onto itself, walked backwards, under a mirror or
 * a half turn: the second half of the solution is the image of the first.
 *
 * Such a path has a middle. Under a mirror the two middle cells face each other
 * across the axis, which needs an even size. Under a half turn the middle is
 * the centre cell, which needs an odd size. Everything else comes in pairs
 * (a cell and its image), and a symmetric path visits one cell of every pair
 * before the middle and the other one after it. So the first half is a
 * Hamiltonian path of the quotient graph, whose nodes are the pairs, that ends
 * on a pair next to the middle. That path is found, mixed by backbiting with
 * its end pinned, and lifted back to cells. At each step either cell of the
 * next pair may be the one next to the current cell, which is what lets the
 * path cross the axis as often as it likes.
 *
 * Returns null when the board is not symmetric (walls and blocked cells must
 * map onto themselves) or no such path turns up within the budget.
 */
export function symmetricPath(
  rng: Rng,
  neighbors: readonly (readonly number[])[],
  skip: Uint8Array,
  size: number,
  symmetry: "mirror-x" | "mirror-y" | "rotate",
  mix: number,
): number[] | null {
  if ((symmetry === "rotate") === (size % 2 === 0)) return null;
  const cellCount = size * size;
  const image = (cell: number): number => mapCell(symmetry, size, cell);
  for (let cell = 0; cell < cellCount; cell++) {
    if (skip[cell] !== skip[image(cell)]) return null;
    if (skip[cell]) continue;
    const mapped = new Set(neighbors[cell].map(image));
    if (neighbors[image(cell)].length !== mapped.size || neighbors[image(cell)].some((other) => !mapped.has(other))) return null;
  }

  // One node per pair. The centre cell of a half turn is a pair of its own.
  const pairOf = new Int32Array(cellCount).fill(-1);
  const members: number[][] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    if (skip[cell] || pairOf[cell] !== -1) continue;
    pairOf[cell] = pairOf[image(cell)] = members.length;
    members.push(image(cell) === cell ? [cell] : [cell, image(cell)]);
  }
  const pairNeighbors = members.map((cells, pair) => [...new Set(cells.flatMap((cell) => neighbors[cell].map((other) => pairOf[other])))].filter((other) => other !== pair));
  // Pairs the first half may end on: the centre cell, or two cells that touch across the axis.
  const middles = members.flatMap((cells, pair) => (cells.length === 1 || neighbors[cells[0]].includes(cells[1]) ? [pair] : []));
  if (middles.length === 0) return null;

  const found = findHamiltonianPath(rng, pairNeighbors, { starts: rng.shuffle(middles) });
  if (!found) return null;
  const half = backbite(rng, found, pairNeighbors, Math.round(members.length * mix), true).reverse();

  const first: number[] = [];
  for (const pair of half) {
    const head = first[first.length - 1];
    const options = head === undefined ? members[pair] : members[pair].filter((cell) => neighbors[head].includes(cell));
    if (options.length === 0) return null;
    first.push(rng.pick(options));
  }
  const centre = members[half[half.length - 1]].length === 1;
  const second = (centre ? first.slice(0, -1) : first).map(image).reverse();
  const path = [...first, ...second];
  return isHamiltonianPath(path, neighbors, members.reduce((sum, cells) => sum + cells.length, 0)) ? path : null;
}
