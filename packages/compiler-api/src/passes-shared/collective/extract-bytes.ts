import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { createInstruction, createMultiAtBundle } from '../ast-utils.js';
import { ExtractBytesAdvancedStatementArgs } from '../advanced-args.js';

function shiftFor(axis: 'row' | 'col', row: number, col: number, byteWidth: number): number {
  const laneIndex = axis === 'row' ? row : col;
  return laneIndex * byteWidth;
}

export function buildExtractBytesBundles(
  advancedStatement: ExtractBytesAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  if (advancedStatement.byteWidth <= 0 || advancedStatement.byteWidth > 16) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported extract_bytes byteWidth '${advancedStatement.byteWidth}'.`,
      'Use byteWidth in range [1, 16].'
    ));
    return [];
  }

  if (grid.rows <= 0 || grid.cols <= 0) {
    return [];
  }

  const srcReg = advancedStatement.srcReg.trim().toUpperCase();
  const destReg = advancedStatement.destReg.trim().toUpperCase();
  const mask = String(advancedStatement.mask);

  const shiftPlacements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];
  const maskPlacements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const shift = String(shiftFor(advancedStatement.axis, row, col, advancedStatement.byteWidth));
      shiftPlacements.push({
        row,
        col,
        instruction: createInstruction('SRT', [destReg, srcReg, shift], span)
      });
      maskPlacements.push({
        row,
        col,
        instruction: createInstruction('LAND', [destReg, destReg, mask], span)
      });
    }
  }

  return [
    createMultiAtBundle(startIndex, shiftPlacements, span),
    createMultiAtBundle(startIndex + 1, maskPlacements, span)
  ];
}
