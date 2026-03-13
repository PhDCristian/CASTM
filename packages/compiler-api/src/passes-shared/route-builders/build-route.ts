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
  createInstruction,
  replaceIncoming
} from '../ast-utils.js';
import { computeRoutePath, getIncomingRegister } from '../grid-utils.js';
import { RoutePragmaArgs } from '../route-args.js';

export function buildRouteCycles(
  route: RoutePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const path = computeRoutePath(route.src, route.dst, grid);
  const cycles: CycleAst[] = [];

  if (path.length === 1) {
    cycles.push(createAtCycle(
      startIndex,
      route.src.row,
      route.src.col,
      createInstruction('SADD', [route.accum, route.accum, route.payload], span),
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
        createInstruction('SADD', ['ROUT', route.payload, 'ZERO'], span),
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
        `Could not resolve route direction for step (${path[i - 1].row},${path[i - 1].col}) -> (${point.row},${point.col}).`
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

    if (route.customOp) {
      const srcA = replaceIncoming(route.customOp.srcA, incoming);
      const srcB = replaceIncoming(route.customOp.srcB, incoming);
      cycles.push(createAtCycle(
        startIndex + i,
        point.row,
        point.col,
        createInstruction(route.customOp.opcode, [route.customOp.dest, srcA, srcB], span),
        span
      ));
      continue;
    }

    cycles.push(createAtCycle(
      startIndex + i,
      point.row,
      point.col,
      createInstruction('SADD', [route.accum, route.accum, incoming], span),
      span
    ));
  }

  return cycles;
}
