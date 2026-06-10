import {
  BundleAst,
  GridSpec,
  SourceSpan
} from '@castm/compiler-ir';
import {
  TriangleAdvancedStatementArgs
} from '../advanced-args.js';
import {
  createInstruction,
  createMultiAtBundle
} from '../ast-utils.js';

function isSelectedCell(
  shape: 'upper' | 'lower',
  inclusive: boolean,
  row: number,
  col: number
): boolean {
  if (shape === 'upper') {
    return inclusive ? col >= row : col > row;
  }

  return inclusive ? row >= col : row > col;
}

export function buildTriangleBundles(
  advancedStatement: TriangleAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan
): BundleAst[] {
  const placements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (!isSelectedCell(advancedStatement.shape, advancedStatement.inclusive, row, col)) continue;
      placements.push({
        row,
        col,
        instruction: createInstruction(
          advancedStatement.opcode,
          [advancedStatement.destReg, advancedStatement.srcA, advancedStatement.srcB],
          span
        )
      });
    }
  }

  if (placements.length === 0) return [];

  return [createMultiAtBundle(startIndex, placements, span)];
}
