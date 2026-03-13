import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { createInstruction, createMultiAtCycle } from '../ast-utils.js';
import { ExtractBytesPragmaArgs } from '../advanced-args.js';

function shiftFor(axis: 'row' | 'col', row: number, col: number, byteWidth: number): number {
  const laneIndex = axis === 'row' ? row : col;
  return laneIndex * byteWidth;
}

export function buildExtractBytesCycles(
  pragma: ExtractBytesPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (pragma.byteWidth <= 0 || pragma.byteWidth > 16) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported extract_bytes byteWidth '${pragma.byteWidth}'.`,
      'Use byteWidth in range [1, 16].'
    ));
    return [];
  }

  if (grid.rows <= 0 || grid.cols <= 0) {
    return [];
  }

  const srcReg = pragma.srcReg.trim().toUpperCase();
  const destReg = pragma.destReg.trim().toUpperCase();
  const mask = String(pragma.mask);

  const shiftPlacements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];
  const maskPlacements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const shift = String(shiftFor(pragma.axis, row, col, pragma.byteWidth));
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
    createMultiAtCycle(startIndex, shiftPlacements, span),
    createMultiAtCycle(startIndex + 1, maskPlacements, span)
  ];
}
