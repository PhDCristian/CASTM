import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createRowBundle
} from '../../ast-utils.js';

export function buildStreamBundles(
  opcode: 'LWD' | 'SWD',
  reg: string,
  row: number,
  count: number,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  if (!Number.isInteger(row) || row < 0 || row >= grid.rows) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `${opcode === 'LWD' ? 'stream_load(...)' : 'stream_store(...)'} row=${row} is outside ${grid.rows} rows.`,
      'Use a valid row index within the current grid.'
    ));
    return [];
  }

  if (!Number.isInteger(count) || count <= 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `${opcode === 'LWD' ? 'stream_load(...)' : 'stream_store(...)'} requires count >= 1, got ${count}.`,
      'Use a positive integer count.'
    ));
    return [];
  }

  const bundles: BundleAst[] = [];
  for (let i = 0; i < count; i++) {
    const instructions = Array.from(
      { length: grid.cols },
      () => createInstruction(opcode, [reg], span)
    );
    bundles.push(createRowBundle(startIndex + bundles.length, row, instructions, span));
  }
  return bundles;
}
