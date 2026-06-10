import {
  BundleAst,
  Diagnostic,
  GridSpec,
  SourceSpan
} from '@castm/compiler-ir';
import { isSamePoint } from '../grid-utils.js';
import { RoutePoint } from '../route-args.js';
import { BroadcastAdvancedStatementArgs } from '../advanced-args.js';
import { buildRouteTransferBundles } from '../route-transfer.js';

export function buildBroadcastBundles(
  advancedStatement: BroadcastAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const targets: RoutePoint[] = [];

  if (advancedStatement.scope === 'row' || advancedStatement.scope === 'all') {
    for (let col = 0; col < grid.cols; col++) {
      if (col === advancedStatement.from.col) continue;
      targets.push({ row: advancedStatement.from.row, col });
    }
  }

  if (advancedStatement.scope === 'column' || advancedStatement.scope === 'all') {
    for (let row = 0; row < grid.rows; row++) {
      if (row === advancedStatement.from.row) continue;
      const point = { row, col: advancedStatement.from.col };
      if (!targets.some((existing) => isSamePoint(existing, point))) {
        targets.push(point);
      }
    }
  }

  if (advancedStatement.scope === 'all') {
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const point = { row, col };
        if (isSamePoint(point, advancedStatement.from)) continue;
        if (!targets.some((existing) => isSamePoint(existing, point))) {
          targets.push(point);
        }
      }
    }
  }

  const bundles: BundleAst[] = [];
  for (const target of targets) {
    const transfer = buildRouteTransferBundles(
      advancedStatement.from,
      target,
      advancedStatement.valueReg,
      advancedStatement.valueReg,
      startIndex + bundles.length,
      grid,
      span,
      diagnostics
    );
    bundles.push(...transfer);
  }

  return bundles;
}
