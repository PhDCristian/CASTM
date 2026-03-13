import {
  CycleAst,
  GridSpec,
  SourceSpan
} from '@castm/compiler-ir';
import {
  TrianglePragmaArgs
} from '../advanced-args.js';
import {
  createInstruction,
  createMultiAtCycle
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

export function buildTriangleCycles(
  pragma: TrianglePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan
): CycleAst[] {
  const placements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (!isSelectedCell(pragma.shape, pragma.inclusive, row, col)) continue;
      placements.push({
        row,
        col,
        instruction: createInstruction(
          pragma.opcode,
          [pragma.destReg, pragma.srcA, pragma.srcB],
          span
        )
      });
    }
  }

  if (placements.length === 0) return [];

  return [createMultiAtCycle(startIndex, placements, span)];
}
