import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createAtCycle,
  createInstruction
} from './ast-utils.js';
import { computeRoutePath, getIncomingRegister } from './grid-utils.js';
import { RoutePoint } from './route-args.js';

export function buildRouteTransferCycles(
  src: RoutePoint,
  dst: RoutePoint,
  payloadReg: string,
  destReg: string,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const path = computeRoutePath(src, dst, grid);
  const cycles: CycleAst[] = [];
  if (path.length === 0) return cycles;

  if (path.length === 1) {
    cycles.push(createAtCycle(
      startIndex,
      src.row,
      src.col,
      createInstruction('SADD', [destReg, payloadReg, 'ZERO'], span),
      span
    ));
    return cycles;
  }

  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const isFirst = i === 0;
    const isLast = i === path.length - 1;

    if (isFirst) {
      cycles.push(createAtCycle(
        startIndex + i,
        point.row,
        point.col,
        createInstruction('SADD', ['ROUT', payloadReg, 'ZERO'], span),
        span
      ));
      continue;
    }

    const incoming = getIncomingRegister(path[i - 1], point, grid);
    if (!incoming) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Internal.UnexpectedState,
        'error',
        span,
        `Could not resolve transfer direction for step (${path[i - 1].row},${path[i - 1].col}) -> (${point.row},${point.col}).`
      ));
      continue;
    }

    if (!isLast) {
      cycles.push(createAtCycle(
        startIndex + i,
        point.row,
        point.col,
        createInstruction('SADD', ['ROUT', incoming, 'ZERO'], span),
        span
      ));
      continue;
    }

    cycles.push(createAtCycle(
      startIndex + i,
      point.row,
      point.col,
      createInstruction('SADD', [destReg, incoming, 'ZERO'], span),
      span
    ));
  }

  return cycles;
}
