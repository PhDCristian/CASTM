import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  InstructionAst,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createMultiAtCycle
} from '../ast-utils.js';
import { RotateShiftPragmaArgs } from '../advanced-args.js';

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
            instruction: createInstruction('SADD', [pragma.reg, 'ZERO', String(fillValue)], span)
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
