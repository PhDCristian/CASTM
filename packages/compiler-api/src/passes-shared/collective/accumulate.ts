import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
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
  rows: number[],
  cols: number[],
  span: SourceSpan,
  build: (row: number, col: number) => { opcode: string; operands: string[] }
): Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> {
  const placements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];
  for (const row of rows) {
    for (const col of cols) {
      const op = build(row, col);
      placements.push({
        row,
        col,
        instruction: createInstruction(op.opcode, op.operands, span)
      });
    }
  }
  return placements;
}

function maxPatternSteps(pattern: AccumulatePragmaArgs['pattern'], rows: number, cols: number): number {
  if (pattern === 'row') {
    return Math.max(1, cols - 1);
  }
  if (pattern === 'col') {
    return Math.max(1, rows - 1);
  }
  return Math.max(1, Math.max(rows - 1, cols - 1));
}

function inBounds(index: number, limit: number): boolean {
  return index >= 0 && index < limit;
}

function resolveScope(
  pragma: AccumulatePragmaArgs,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): { rows: number[]; cols: number[]; mode: 'all' | 'row' | 'col' } | null {
  const scope = pragma.scope ?? { kind: 'all' as const };
  if (scope.kind === 'all') {
    return {
      rows: Array.from({ length: grid.rows }, (_, i) => i),
      cols: Array.from({ length: grid.cols }, (_, i) => i),
      mode: 'all'
    };
  }

  if (scope.kind === 'row') {
    if (!inBounds(scope.index, grid.rows)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.CoordinateOutOfBounds,
        'error',
        span,
        `Accumulate scope row(${scope.index}) is out of bounds for ${grid.rows}x${grid.cols} grid.`,
        `Use row index in range [0, ${Math.max(0, grid.rows - 1)}].`
      ));
      return null;
    }
    return {
      rows: [scope.index],
      cols: Array.from({ length: grid.cols }, (_, i) => i),
      mode: 'row'
    };
  }

  if (!inBounds(scope.index, grid.cols)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `Accumulate scope col(${scope.index}) is out of bounds for ${grid.rows}x${grid.cols} grid.`,
      `Use col index in range [0, ${Math.max(0, grid.cols - 1)}].`
    ));
    return null;
  }

  return {
    rows: Array.from({ length: grid.rows }, (_, i) => i),
    cols: [scope.index],
    mode: 'col'
  };
}

function isPatternCompatibleWithScope(
  pattern: AccumulatePragmaArgs['pattern'],
  mode: 'all' | 'row' | 'col'
): boolean {
  if (mode === 'all') return true;
  if (mode === 'row') return pattern === 'row';
  return pattern === 'col';
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
  const steps = Number.isInteger(pragma.steps) ? pragma.steps : 1;
  const scopeInfo = resolveScope(pragma, grid, span, diagnostics);
  if (!scopeInfo) return [];

  if (!isPatternCompatibleWithScope(pragma.pattern, scopeInfo.mode)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported accumulate pattern '${pragma.pattern}' for scope '${scopeInfo.mode}'.`,
      scopeInfo.mode === 'row'
        ? 'Use pattern=row with scope=row(i), or scope=all for full-grid patterns.'
        : 'Use pattern=col with scope=col(j), or scope=all for full-grid patterns.'
    ));
    return [];
  }

  const maxSteps = maxPatternSteps(pragma.pattern, scopeInfo.rows.length, scopeInfo.cols.length);

  if (steps <= 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported accumulate steps '${String((pragma as { steps?: unknown }).steps)}'.`,
      'Use an integer value >= 1.'
    ));
    return [];
  }

  if (steps > maxSteps) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported accumulate steps '${steps}' for pattern '${pragma.pattern}' on ${grid.rows}x${grid.cols} grid (max ${maxSteps}).`,
      `Use steps <= ${maxSteps} for this grid/pattern combination.`
    ));
    return [];
  }

  const cycles: CycleAst[] = [];

  if (accumReg !== productsReg) {
    const seedPlacements = buildStagePlacements(scopeInfo.rows, scopeInfo.cols, span, () => ({
      opcode: 'SADD',
      operands: [accumReg, productsReg, 'ZERO']
    }));
    cycles.push(createMultiAtCycle(startIndex + cycles.length, seedPlacements, span));
  }

  if (pragma.pattern === 'row') {
    const leftBoundaryCol = scopeInfo.cols[0] ?? 0;
    for (let step = 0; step < steps; step++) {
      const rowPlacements = buildStagePlacements(scopeInfo.rows, scopeInfo.cols, span, (_row, col) => ({
        opcode: combineOpcode,
        operands: [accumReg, accumReg, col === leftBoundaryCol ? 'ZERO' : 'RCL']
      }));
      cycles.push(createMultiAtCycle(startIndex + cycles.length, rowPlacements, span));
    }
  } else if (pragma.pattern === 'col') {
    const topBoundaryRow = scopeInfo.rows[0] ?? 0;
    for (let step = 0; step < steps; step++) {
      const colPlacements = buildStagePlacements(scopeInfo.rows, scopeInfo.cols, span, (row) => ({
        opcode: combineOpcode,
        operands: [accumReg, accumReg, row === topBoundaryRow ? 'ZERO' : 'RCT']
      }));
      cycles.push(createMultiAtCycle(startIndex + cycles.length, colPlacements, span));
    }
  } else if (pragma.pattern === 'anti_diagonal') {
    const topBoundaryRow = scopeInfo.rows[0] ?? 0;
    const rightBoundaryCol = scopeInfo.cols[scopeInfo.cols.length - 1] ?? 0;
    for (let step = 0; step < steps; step++) {
      const verticalPlacements = buildStagePlacements(scopeInfo.rows, scopeInfo.cols, span, (row, col) => ({
        opcode: combineOpcode,
        operands: [accumReg, accumReg, (row === topBoundaryRow || col === rightBoundaryCol) ? 'ZERO' : 'RCT']
      }));
      cycles.push(createMultiAtCycle(startIndex + cycles.length, verticalPlacements, span));
    }

    for (let step = 0; step < steps; step++) {
      const horizontalPlacements = buildStagePlacements(scopeInfo.rows, scopeInfo.cols, span, (_row, col) => ({
        opcode: combineOpcode,
        operands: [accumReg, accumReg, col === rightBoundaryCol ? 'ZERO' : 'RCR']
      }));
      cycles.push(createMultiAtCycle(startIndex + cycles.length, horizontalPlacements, span));
    }
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

  if (outReg !== accumReg) {
    const finalPlacements = buildStagePlacements(scopeInfo.rows, scopeInfo.cols, span, () => ({
      opcode: 'SADD',
      operands: [outReg, accumReg, 'ZERO']
    }));
    cycles.push(createMultiAtCycle(startIndex + cycles.length, finalPlacements, span));
  }

  return cycles;
}
