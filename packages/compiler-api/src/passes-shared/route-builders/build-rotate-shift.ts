import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  InstructionAst,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createMultiAtBundle
} from '../ast-utils.js';
import { RotateShiftAdvancedStatementArgs } from '../advanced-args.js';

export function buildRotateShiftBundles(
  advancedStatement: RotateShiftAdvancedStatementArgs,
  isShift: boolean,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
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
    ? advancedStatement.distance
    : (advancedStatement.distance % grid.cols + grid.cols) % grid.cols;
  if (iterations === 0) {
    return [];
  }

  const bundles: BundleAst[] = [];
  const neighborReg = advancedStatement.direction === 'left' ? 'RCR' : 'RCL';
  const edgeCol = advancedStatement.direction === 'left' ? grid.cols - 1 : 0;
  const fillValue = advancedStatement.fill ?? 0;

  for (let step = 0; step < iterations; step++) {
    const sendPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        sendPlacements.push({
          row,
          col,
          instruction: createInstruction('SADD', ['ROUT', advancedStatement.reg, 'ZERO'], span)
        });
      }
    }
    bundles.push(createMultiAtBundle(startIndex + bundles.length, sendPlacements, span));

    const recvPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (isShift && col === edgeCol) {
          recvPlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [advancedStatement.reg, 'ZERO', String(fillValue)], span)
          });
          continue;
        }

        recvPlacements.push({
          row,
          col,
          instruction: createInstruction('SADD', [advancedStatement.reg, neighborReg, 'ZERO'], span)
        });
      }
    }
    bundles.push(createMultiAtBundle(startIndex + bundles.length, recvPlacements, span));
  }

  return bundles;
}
