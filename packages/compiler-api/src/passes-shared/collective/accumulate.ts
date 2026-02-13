import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { AccumulatePragmaArgs } from '../advanced-args.js';
import { createInstruction, createMultiAtCycle } from '../ast-utils.js';

const COMBINE_OPCODE: ReadonlyMap<AccumulatePragmaArgs['combine'], string> = new Map([
  ['add', 'SADD'],
  ['sum', 'SADD'],
  ['sub', 'SSUB'],
  ['and', 'LAND'],
  ['or', 'LOR'],
  ['xor', 'LXOR'],
  ['mul', 'SMUL']
]);

function upperToken(value: string): string {
  return value.trim().toUpperCase();
}

function buildStagePlacements(
  grid: GridSpec,
  build: (row: number, col: number) => { opcode: string; operands: string[] }
): Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> {
  const placements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const op = build(row, col);
      placements.push({
        row,
        col,
        instruction: createInstruction(op.opcode, op.operands, { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 })
      });
    }
  }
  return placements;
}

export function buildAccumulateCycles(
  pragma: AccumulatePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const combineOpcode = COMBINE_OPCODE.get(pragma.combine);
  if (!combineOpcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported accumulate combine mode '${pragma.combine}'.`,
      'Use one of: add, sum, sub, and, or, xor, mul.'
    ));
    return [];
  }

  const productsReg = upperToken(pragma.productsReg);
  const accumReg = upperToken(pragma.accumReg);
  const outReg = upperToken(pragma.outReg);

  const cycles: CycleAst[] = [];

  const stage0Placements = buildStagePlacements(grid, () => ({
    opcode: 'SADD',
    operands: [accumReg, productsReg, 'ZERO']
  })).map((placement) => ({
    ...placement,
    instruction: { ...placement.instruction, span }
  }));
  cycles.push(createMultiAtCycle(startIndex, stage0Placements, span));

  if (pragma.pattern === 'row') {
    const stage1Placements = buildStagePlacements(grid, (_row, col) => ({
      opcode: combineOpcode,
      operands: [accumReg, accumReg, col === 0 ? 'ZERO' : 'RCL']
    })).map((placement) => ({
      ...placement,
      instruction: { ...placement.instruction, span }
    }));
    cycles.push(createMultiAtCycle(startIndex + cycles.length, stage1Placements, span));
  } else if (pragma.pattern === 'col') {
    const stage1Placements = buildStagePlacements(grid, (row) => ({
      opcode: combineOpcode,
      operands: [accumReg, accumReg, row === 0 ? 'ZERO' : 'RCT']
    })).map((placement) => ({
      ...placement,
      instruction: { ...placement.instruction, span }
    }));
    cycles.push(createMultiAtCycle(startIndex + cycles.length, stage1Placements, span));
  } else if (pragma.pattern === 'anti_diagonal') {
    const stage1Placements = buildStagePlacements(grid, (row, col) => ({
      opcode: combineOpcode,
      operands: [accumReg, accumReg, (row === 0 || col === grid.cols - 1) ? 'ZERO' : 'RCT']
    })).map((placement) => ({
      ...placement,
      instruction: { ...placement.instruction, span }
    }));
    cycles.push(createMultiAtCycle(startIndex + cycles.length, stage1Placements, span));

    const stage2Placements = buildStagePlacements(grid, (_row, col) => ({
      opcode: combineOpcode,
      operands: [accumReg, accumReg, col === grid.cols - 1 ? 'ZERO' : 'RCR']
    })).map((placement) => ({
      ...placement,
      instruction: { ...placement.instruction, span }
    }));
    cycles.push(createMultiAtCycle(startIndex + cycles.length, stage2Placements, span));
  } else {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported accumulate pattern '${pragma.pattern}'.`,
      'Use one of: row, col, anti_diagonal.'
    ));
    return [];
  }

  const finalPlacements = buildStagePlacements(grid, () => ({
    opcode: 'SADD',
    operands: [outReg, accumReg, 'ZERO']
  })).map((placement) => ({
    ...placement,
    instruction: { ...placement.instruction, span }
  }));
  cycles.push(createMultiAtCycle(startIndex + cycles.length, finalPlacements, span));

  return cycles;
}
