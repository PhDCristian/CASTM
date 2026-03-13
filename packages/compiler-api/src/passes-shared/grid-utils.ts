import { GridSpec } from '@castm/compiler-ir';

export interface GridPoint {
  row: number;
  col: number;
}

export function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export function isSamePoint(a: GridPoint, b: GridPoint): boolean {
  return a.row === b.row && a.col === b.col;
}

export function computeRoutePath(src: GridPoint, dst: GridPoint, grid: GridSpec): GridPoint[] {
  if (isSamePoint(src, dst)) {
    return [{ ...src }];
  }

  const path: GridPoint[] = [{ ...src }];
  let current: GridPoint = { ...src };

  if (grid.topology === 'torus') {
    const rightDist = (dst.col - current.col + grid.cols) % grid.cols;
    const leftDist = (current.col - dst.col + grid.cols) % grid.cols;
    const hStep = rightDist <= leftDist ? 1 : -1;
    const hCount = rightDist <= leftDist ? rightDist : leftDist;

    for (let i = 0; i < hCount; i++) {
      current = { row: current.row, col: wrap(current.col + hStep, grid.cols) };
      path.push(current);
    }

    const downDist = (dst.row - current.row + grid.rows) % grid.rows;
    const upDist = (current.row - dst.row + grid.rows) % grid.rows;
    const vStep = downDist <= upDist ? 1 : -1;
    const vCount = downDist <= upDist ? downDist : upDist;

    for (let i = 0; i < vCount; i++) {
      current = { row: wrap(current.row + vStep, grid.rows), col: current.col };
      path.push(current);
    }
    return path;
  }

  const hStep = dst.col >= current.col ? 1 : -1;
  while (current.col !== dst.col) {
    current = { row: current.row, col: current.col + hStep };
    path.push(current);
  }

  const vStep = dst.row >= current.row ? 1 : -1;
  while (current.row !== dst.row) {
    current = { row: current.row + vStep, col: current.col };
    path.push(current);
  }

  return path;
}

export function isStep(
  prev: GridPoint,
  curr: GridPoint,
  deltaRow: number,
  deltaCol: number,
  grid: GridSpec
): boolean {
  if (grid.topology === 'torus') {
    return (
      wrap(prev.row + deltaRow, grid.rows) === curr.row &&
      wrap(prev.col + deltaCol, grid.cols) === curr.col
    );
  }

  return prev.row + deltaRow === curr.row && prev.col + deltaCol === curr.col;
}

export function getIncomingRegister(prev: GridPoint, curr: GridPoint, grid: GridSpec): string | null {
  if (prev.row === curr.row) {
    if (isStep(prev, curr, 0, 1, grid)) return 'RCL';
    if (isStep(prev, curr, 0, -1, grid)) return 'RCR';
  }

  if (prev.col === curr.col) {
    if (isStep(prev, curr, 1, 0, grid)) return 'RCT';
    if (isStep(prev, curr, -1, 0, grid)) return 'RCB';
  }

  return null;
}

export function isPointInGrid(point: GridPoint, grid: GridSpec): boolean {
  return (
    point.row >= 0 &&
    point.row < grid.rows &&
    point.col >= 0 &&
    point.col < grid.cols
  );
}
