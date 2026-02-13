import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { createInstruction, createMultiAtCycle } from '../ast-utils.js';
import { CollectPragmaArgs } from '../advanced-args.js';

const VALID_VIA_REGS = new Set(['SELF', 'RCT', 'RCB', 'RCL', 'RCR']);

const COMBINE_OPCODE: ReadonlyMap<CollectPragmaArgs['combine'], string | null> = new Map([
  ['copy', null],
  ['add', 'SADD'],
  ['sum', 'SADD'],
  ['sub', 'SSUB'],
  ['and', 'LAND'],
  ['or', 'LOR'],
  ['xor', 'LXOR'],
  ['mul', 'SMUL'],
  ['shift_add', 'SADD']
]);

function toUpperToken(value: string): string {
  return value.trim().toUpperCase();
}

function expectedViaForSingleHop(
  axis: 'row' | 'col',
  fromIndex: number,
  toIndex: number
): string | null {
  if (fromIndex === toIndex) return 'SELF';

  if (axis === 'row') {
    if (fromIndex === toIndex - 1) return 'RCT';
    if (fromIndex === toIndex + 1) return 'RCB';
    return null;
  }

  if (fromIndex === toIndex - 1) return 'RCL';
  if (fromIndex === toIndex + 1) return 'RCR';
  return null;
}

function inBounds(axis: 'row' | 'col', index: number, grid: GridSpec): boolean {
  if (axis === 'row') {
    return index >= 0 && index < grid.rows;
  }
  return index >= 0 && index < grid.cols;
}

function getLaneLength(axis: 'row' | 'col', grid: GridSpec): number {
  return axis === 'row' ? grid.cols : grid.rows;
}

function resolvePlacement(axis: 'row' | 'col', fixedIndex: number, lane: number): { row: number; col: number } {
  if (axis === 'row') {
    return { row: fixedIndex, col: lane };
  }
  return { row: lane, col: fixedIndex };
}

export function buildCollectCycles(
  pragma: CollectPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const axis = pragma.from.axis;
  const fromIndex = pragma.from.index;
  const toIndex = pragma.to.index;

  if (!inBounds(axis, fromIndex, grid) || !inBounds(axis, toIndex, grid)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `Collect ${axis} indices out of bounds: from=${fromIndex}, to=${toIndex}.`,
      axis === 'row'
        ? `Rows must be within [0, ${Math.max(0, grid.rows - 1)}].`
        : `Columns must be within [0, ${Math.max(0, grid.cols - 1)}].`
    ));
    return [];
  }

  const viaReg = toUpperToken(pragma.viaReg);
  if (!VALID_VIA_REGS.has(viaReg)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported collect via register '${pragma.viaReg}'.`,
      'Use SELF, RCT, RCB, RCL or RCR.'
    ));
    return [];
  }

  const expectedVia = expectedViaForSingleHop(axis, fromIndex, toIndex);
  if (!expectedVia) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `collect(from=${axis}(${fromIndex}), to=${axis}(${toIndex})) is not single-hop aligned.`,
      `Current collect lowering supports same-lane or adjacent-lane transfers only (${axis} distance <= 1).`
    ));
    return [];
  }

  if (viaReg !== expectedVia) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Collect via register mismatch: expected ${expectedVia} for from=${axis}(${fromIndex}) to=${axis}(${toIndex}), got ${viaReg}.`,
      'Adjust via to match the geometric neighbor direction or set from/to accordingly.'
    ));
    return [];
  }

  const laneLength = getLaneLength(axis, grid);
  if (laneLength <= 0) {
    return [];
  }

  const combine = pragma.combine;
  const combineOpcode = COMBINE_OPCODE.get(combine);
  if (combineOpcode === undefined) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported collect combine mode '${combine}'.`,
      'Supported combine values: copy, add, sum, sub, and, or, xor, mul, shift_add.'
    ));
    return [];
  }

  const destReg = toUpperToken(pragma.destReg);
  const localReg = toUpperToken(pragma.localReg);

  const copyPlacements = Array.from({ length: laneLength }, (_, lane) => {
    const point = resolvePlacement(axis, toIndex, lane);
    return {
      row: point.row,
      col: point.col,
      instruction: createInstruction('SADD', [destReg, viaReg, 'ZERO'], span)
    };
  });

  const cycles: CycleAst[] = [createMultiAtCycle(startIndex, copyPlacements, span)];

  if (combineOpcode === null) {
    return cycles;
  }

  const combinePlacements = Array.from({ length: laneLength }, (_, lane) => {
    const point = resolvePlacement(axis, toIndex, lane);

    if (combine === 'shift_add') {
      const incoming = lane === 0
        ? 'ZERO'
        : axis === 'row'
          ? 'RCL'
          : 'RCT';
      return {
        row: point.row,
        col: point.col,
        instruction: createInstruction('SADD', [destReg, localReg, incoming], span)
      };
    }

    return {
      row: point.row,
      col: point.col,
      instruction: createInstruction(combineOpcode, [destReg, localReg, destReg], span)
    };
  });

  cycles.push(createMultiAtCycle(startIndex + cycles.length, combinePlacements, span));

  return cycles;
}
