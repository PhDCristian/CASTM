import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  InstructionAst,
  SourceSpan,
  makeDiagnostic
} from '@openedge/compiler-ir';
import {
  createAtCycle,
  createInstruction,
  createMultiAtCycle,
  replaceIncoming
} from './ast-utils.js';
import { computeRoutePath, getIncomingRegister, isSamePoint } from './grid-utils.js';
import { RoutePoint, RoutePragmaArgs } from './route-args.js';
import { BroadcastPragmaArgs, RotateShiftPragmaArgs } from './advanced-args.js';
import { buildRouteTransferCycles } from './route-transfer.js';

export { buildRouteTransferCycles } from './route-transfer.js';

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

export function buildRotateShiftCycles(
  pragma: RotateShiftPragmaArgs,
  isShift: boolean,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (grid.rows <= 0 || grid.cols <= 0) {
    return [];
  }

  if (!isShift && grid.topology !== 'torus') {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `rotate(...) currently requires torus topology, got '${grid.topology}'.`,
      'Use topology torus or switch to shift(...) for mesh.'
    ));
    return [];
  }

  const iterations = isShift
    ? pragma.distance
    : (pragma.distance % grid.cols + grid.cols) % grid.cols;
  if (iterations === 0) {
    return [];
  }

  const cycles: CycleAst[] = [];
  const neighborReg = pragma.direction === 'left' ? 'RCR' : 'RCL';
  const edgeCol = pragma.direction === 'left' ? grid.cols - 1 : 0;
  const fillValue = pragma.fill ?? 0;

  for (let step = 0; step < iterations; step++) {
    const sendPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        sendPlacements.push({
          row,
          col,
          instruction: createInstruction('SADD', ['ROUT', pragma.reg, 'ZERO'], span)
        });
      }
    }
    cycles.push(createMultiAtCycle(startIndex + cycles.length, sendPlacements, span));

    const recvPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (isShift && col === edgeCol) {
          recvPlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [pragma.reg, 'ZERO', `IMM(${fillValue})`], span)
          });
          continue;
        }

        recvPlacements.push({
          row,
          col,
          instruction: createInstruction('SADD', [pragma.reg, neighborReg, 'ZERO'], span)
        });
      }
    }
    cycles.push(createMultiAtCycle(startIndex + cycles.length, recvPlacements, span));
  }

  return cycles;
}

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
