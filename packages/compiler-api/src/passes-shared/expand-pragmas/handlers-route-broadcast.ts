import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import { isPointInGrid } from '../grid-utils.js';
import { parseRoutePragmaArgs } from '../route-args.js';
import { parseBroadcastPragmaArgs } from '../advanced-args.js';
import {
  buildBroadcastCycles,
  buildRouteCycles
} from '../route-builders.js';
import { PragmaHandler } from './types.js';

export const handleRoute: PragmaHandler = (pragma, ctx) => {
  const parsed = parseRoutePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid route statement syntax: '${pragma.text}'.`,
      'Use route(@r1,c1 -> @r2,c2, payload=Rx, accum=Ry) or route(..., payload=Rx, dest=Rz, op=OP(Rd, Ra, Rb)).'
    ));
    return;
  }

  if (!isPointInGrid(parsed.src, ctx.grid) || !isPointInGrid(parsed.dst, ctx.grid)) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      pragma.span,
      `Route coordinates @${parsed.src.row},${parsed.src.col} -> @${parsed.dst.row},${parsed.dst.col} are outside ${ctx.grid.rows}x${ctx.grid.cols}.`,
      'Adjust coordinates or change CompileOptions.grid.'
    ));
    return;
  }

  const cycles = buildRouteCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};

export const handleBroadcast: PragmaHandler = (pragma, ctx) => {
  const parsed = parseBroadcastPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid broadcast statement syntax: '${pragma.text}'.`,
      'Use broadcast(value=R0, from=@row,col, to=row|column|all).'
    ));
    return;
  }

  if (!isPointInGrid(parsed.from, ctx.grid)) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      pragma.span,
      `Broadcast source @${parsed.from.row},${parsed.from.col} is outside ${ctx.grid.rows}x${ctx.grid.cols}.`,
      'Adjust source coordinates or change CompileOptions.grid.'
    ));
    return;
  }

  const cycles = buildBroadcastCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
