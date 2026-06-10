import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import { isPointInGrid } from '../grid-utils.js';
import { parseRouteAdvancedStatementArgs } from '../route-args.js';
import { parseBroadcastAdvancedStatementArgs } from '../advanced-args.js';
import {
  buildBroadcastBundles,
  buildRouteBundles
} from '../route-builders.js';
import { AdvancedStatementHandler } from './types.js';

export const handleRoute: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseRouteAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid route statement syntax: '${advancedStatement.text}'.`,
      'Use route(@r1,c1 -> @r2,c2, payload=Rx, accum=Ry) or route(..., payload=Rx, dest=Rz, op=OP(Rd, Ra, Rb)).'
    ));
    return;
  }

  if (!isPointInGrid(parsed.src, ctx.grid) || !isPointInGrid(parsed.dst, ctx.grid)) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      advancedStatement.span,
      `Route coordinates @${parsed.src.row},${parsed.src.col} -> @${parsed.dst.row},${parsed.dst.col} are outside ${ctx.grid.rows}x${ctx.grid.cols}.`,
      'Adjust coordinates or change CompileOptions.grid.'
    ));
    return;
  }

  const bundles = buildRouteBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};

export const handleBroadcast: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseBroadcastAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid broadcast statement syntax: '${advancedStatement.text}'.`,
      'Use broadcast(value=R0, from=@row,col, to=row|column|all).'
    ));
    return;
  }

  if (!isPointInGrid(parsed.from, ctx.grid)) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      advancedStatement.span,
      `Broadcast source @${parsed.from.row},${parsed.from.col} is outside ${ctx.grid.rows}x${ctx.grid.cols}.`,
      'Adjust source coordinates or change CompileOptions.grid.'
    ));
    return;
  }

  const bundles = buildBroadcastBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
