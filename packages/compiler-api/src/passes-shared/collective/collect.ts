import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { createInstruction, createMultiAtBundle } from '../ast-utils.js';
import { CollectAdvancedStatementArgs } from '../advanced-args.js';

const VALID_VIA_REGS = new Set(['SELF', 'RCT', 'RCB', 'RCL', 'RCR']);

const COMBINE_OPCODE: ReadonlyMap<CollectAdvancedStatementArgs['combine'], string | null> = new Map([
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

function expectedViaForDirection(
  axis: 'row' | 'col',
  fromIndex: number,
  toIndex: number
): string {
  if (fromIndex === toIndex) return 'SELF';
  if (axis === 'row') {
    return fromIndex < toIndex ? 'RCT' : 'RCB';
  }
  return fromIndex < toIndex ? 'RCL' : 'RCR';
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

export function buildCollectBundles(
  advancedStatement: CollectAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const axis = advancedStatement.from.axis;
  const fromIndex = advancedStatement.from.index;
  const toIndex = advancedStatement.to.index;

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

  const viaReg = toUpperToken(advancedStatement.viaReg);
  if (!VALID_VIA_REGS.has(viaReg)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported collect via register '${advancedStatement.viaReg}'.`,
      'Use SELF, RCT, RCB, RCL or RCR.'
    ));
    return [];
  }

  const laneDistance = Math.abs(fromIndex - toIndex);
  const pathMode = advancedStatement.path ?? 'single_hop';
  const expectedVia = pathMode === 'single_hop'
    ? expectedViaForSingleHop(axis, fromIndex, toIndex)
    : expectedViaForDirection(axis, fromIndex, toIndex);

  if (pathMode === 'single_hop' && !expectedVia) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidCollectPath,
      'error',
      span,
      `collect(from=${axis}(${fromIndex}), to=${axis}(${toIndex}), path=single_hop) is not single-hop aligned.`,
      `Use path=multi_hop for distance > 1, or keep ${axis} distance <= 1.`
    ));
    return [];
  }

  if (pathMode === 'multi_hop' && advancedStatement.maxHops !== undefined && laneDistance > advancedStatement.maxHops) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidCollectPath,
      'error',
      span,
      `collect(..., path=multi_hop, max_hops=${advancedStatement.maxHops}) cannot cover ${laneDistance} hops.`,
      `Increase max_hops to at least ${laneDistance}, or reduce from/to distance.`
    ));
    return [];
  }

  if (expectedVia && viaReg !== expectedVia) {
    diagnostics.push(makeDiagnostic(
      pathMode === 'single_hop'
        ? ErrorCodes.Semantic.UnsupportedOperation
        : ErrorCodes.Semantic.InvalidCollectPath,
      'error',
      span,
      `Collect via register mismatch: expected ${expectedVia} for from=${axis}(${fromIndex}) to=${axis}(${toIndex}), got ${viaReg}.`,
      pathMode === 'single_hop'
        ? 'Adjust via to match the geometric neighbor direction or set from/to accordingly.'
        : 'For multi_hop, use via matching the travel direction of the path.'
    ));
    return [];
  }

  const laneLength = getLaneLength(axis, grid);
  if (laneLength <= 0) {
    return [];
  }

  const combine = advancedStatement.combine;
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

  const destReg = toUpperToken(advancedStatement.destReg);
  const localReg = toUpperToken(advancedStatement.localReg);

  const hopTargets: number[] = [];
  if (pathMode === 'single_hop' || laneDistance === 0) {
    hopTargets.push(toIndex);
  } else {
    const step = toIndex > fromIndex ? 1 : -1;
    for (let idx = fromIndex + step; step > 0 ? idx <= toIndex : idx >= toIndex; idx += step) {
      hopTargets.push(idx);
    }
  }

  const bundles: BundleAst[] = [];
  for (const hopTarget of hopTargets) {
    const copyPlacements = Array.from({ length: laneLength }, (_, lane) => {
      const point = resolvePlacement(axis, hopTarget, lane);
      return {
        row: point.row,
        col: point.col,
        instruction: createInstruction('SADD', [destReg, viaReg, 'ZERO'], span)
      };
    });
    bundles.push(createMultiAtBundle(startIndex + bundles.length, copyPlacements, span));
  }

  if (combineOpcode === null) {
    return bundles;
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

  bundles.push(createMultiAtBundle(startIndex + bundles.length, combinePlacements, span));

  return bundles;
}
