import {
  CycleAst,
  Diagnostic,
  GridSpec,
  SourceSpan
} from '@castm/compiler-ir';
import { isSamePoint } from '../grid-utils.js';
import { RoutePoint } from '../route-args.js';
import { BroadcastPragmaArgs } from '../advanced-args.js';
import { buildRouteTransferCycles } from '../route-transfer.js';

export function buildBroadcastCycles(
  pragma: BroadcastPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const targets: RoutePoint[] = [];

  if (pragma.scope === 'row' || pragma.scope === 'all') {
    for (let col = 0; col < grid.cols; col++) {
      if (col === pragma.from.col) continue;
      targets.push({ row: pragma.from.row, col });
    }
  }

  if (pragma.scope === 'column' || pragma.scope === 'all') {
    for (let row = 0; row < grid.rows; row++) {
      if (row === pragma.from.row) continue;
      const point = { row, col: pragma.from.col };
      if (!targets.some((existing) => isSamePoint(existing, point))) {
        targets.push(point);
      }
    }
  }

  if (pragma.scope === 'all') {
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const point = { row, col };
        if (isSamePoint(point, pragma.from)) continue;
        if (!targets.some((existing) => isSamePoint(existing, point))) {
          targets.push(point);
        }
      }
    }
  }

  const cycles: CycleAst[] = [];
  for (const target of targets) {
    const transfer = buildRouteTransferCycles(
      pragma.from,
      target,
      pragma.valueReg,
      pragma.valueReg,
      startIndex + cycles.length,
      grid,
      span,
      diagnostics
    );
    cycles.push(...transfer);
  }

  return cycles;
}
