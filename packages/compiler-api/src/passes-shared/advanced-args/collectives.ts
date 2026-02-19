import {
  isIdentifier,
  parseIntegerLiteral,
  parseKeyValueArgs,
  splitPositionalArgs
} from '../pragma-args-utils.js';
import { parseCoordinateLiteral } from '../route-args.js';
import {
  AccumulatePragmaArgs,
  CarryChainPragmaArgs,
  CollectAxisRef,
  CollectPragmaArgs,
  ConditionalSubPragmaArgs,
  ExtractBytesPragmaArgs,
  GuardPragmaArgs,
  GatherPragmaArgs,
  MulaccChainPragmaArgs,
  NormalizePragmaArgs,
  StencilPragmaArgs,
  TrianglePragmaArgs,
  TransposePragmaArgs
} from './types.js';

const COLLECT_COMBINE_VALUES = new Set([
  'copy',
  'add',
  'sum',
  'sub',
  'and',
  'or',
  'xor',
  'mul',
  'shift_add'
]);
const ACCUMULATE_COMBINE_VALUES = new Set([
  'add',
  'sum',
  'sub',
  'and',
  'or',
  'xor',
  'mul'
]);
const MULACC_DIRECTIONS = new Set([
  'left',
  'right',
  'up',
  'down'
]);
function parseAccumulateScope(value: string): AccumulatePragmaArgs['scope'] | null {
  const normalized = value.trim();
  if (normalized.toLowerCase() === 'all') {
    return { kind: 'all' };
  }

  const rowMatch = normalized.match(/^row\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (rowMatch) {
    const index = parseIntegerLiteral(rowMatch[1])!;
    return { kind: 'row', index };
  }

  const colMatch = normalized.match(/^col\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (colMatch) {
    const index = parseIntegerLiteral(colMatch[1])!;
    return { kind: 'col', index };
  }

  return null;
}

function parseCollectAxisRef(value: string): CollectAxisRef | null {
  const match = value.trim().match(/^(row|col)\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (!match) return null;
  return {
    axis: match[1].toLowerCase() as 'row' | 'col',
    index: Number(match[2])
  };
}

function defaultMaskForWidth(width: number): number | null {
  if (!Number.isInteger(width) || width <= 0 || width >= 31) return null;
  return (1 << width) - 1;
}
function parseMulaccTarget(value: string): MulaccChainPragmaArgs['target'] | null {
  const normalized = value.trim();
  if (normalized.toLowerCase() === 'all') return { kind: 'all' as const };

  const rowMatch = normalized.match(/^row\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (rowMatch) {
    const index = parseIntegerLiteral(rowMatch[1])!;
    return { kind: 'row' as const, index };
  }

  const colMatch = normalized.match(/^col\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (colMatch) {
    const index = parseIntegerLiteral(colMatch[1])!;
    return { kind: 'col' as const, index };
  }

  return null;
}

export function parseMulaccChainPragmaArgs(text: string): MulaccChainPragmaArgs | null {
  const match = text.trim().match(/^mulacc_chain\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;

  for (const key of args.keys()) {
    if (!['src', 'coeff', 'acc', 'out', 'target', 'lanes', 'width', 'mask', 'dir'].includes(key)) {
      return null;
    }
  }

  const srcReg = args.get('src')?.trim();
  const coeffReg = args.get('coeff')?.trim();
  const accReg = args.get('acc')?.trim();
  const outReg = args.get('out')?.trim();
  const targetRaw = args.get('target');
  const widthRaw = args.get('width');
  const dirRaw = args.get('dir')?.trim().toLowerCase();

  if (!srcReg || !coeffReg || !accReg || !outReg || !targetRaw || !widthRaw || !dirRaw) return null;
  if (!isIdentifier(srcReg) || !isIdentifier(coeffReg) || !isIdentifier(accReg) || !isIdentifier(outReg)) return null;
  if (!MULACC_DIRECTIONS.has(dirRaw)) return null;

  const target = parseMulaccTarget(targetRaw);
  if (!target) return null;

  const width = parseIntegerLiteral(widthRaw);
  if (width === null || width <= 0 || width >= 31) return null;

  const maskRaw = args.get('mask');
  const mask = maskRaw ? parseIntegerLiteral(maskRaw) : defaultMaskForWidth(width);
  if (mask === null) return null;

  const lanesRaw = args.get('lanes');
  let lanes: number | undefined;
  if (lanesRaw !== undefined) {
    const parsedLanes = parseIntegerLiteral(lanesRaw);
    if (parsedLanes === null || parsedLanes <= 0) return null;
    lanes = parsedLanes;
  }

  return {
    srcReg,
    coeffReg,
    accReg,
    outReg,
    target,
    lanes: lanes ?? undefined,
    width,
    mask,
    direction: dirRaw as MulaccChainPragmaArgs['direction']
  };
}
export function parseStencilPragmaArgs(text: string): StencilPragmaArgs | null {
  const match = text.trim().match(/^stencil\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const parts = splitPositionalArgs(match[1]);
  if (!parts || (parts.length !== 3 && parts.length !== 4)) {
    return null;
  }

  const pattern = parts[0].toLowerCase();
  const operation = (parts.length === 4 ? parts[1] : 'sum').toLowerCase();
  const srcReg = parts.length === 4 ? parts[2] : parts[1];
  const destReg = parts.length === 4 ? parts[3] : parts[2];

  if (!['cross', 'horizontal', 'vertical'].includes(pattern)) return null;
  if (!isIdentifier(operation) || !isIdentifier(srcReg) || !isIdentifier(destReg)) return null;

  return {
    pattern: pattern as 'cross' | 'horizontal' | 'vertical',
    operation,
    srcReg,
    destReg
  };
}

function parseTriangleInclusive(value: string | undefined): boolean | null {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === 'inclusive') return true;
  if (normalized === 'false' || normalized === 'exclusive') return false;
  return null;
}
export function parseTrianglePragmaArgs(text: string): TrianglePragmaArgs | null {
  const match = text.trim().match(/^triangle\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['shape', 'inclusive', 'op', 'dest', 'srca', 'srcb'].includes(key)) return null;
  }

  const shape = args.get('shape')?.trim().toLowerCase();
  if (shape !== 'upper' && shape !== 'lower') return null;

  const inclusive = parseTriangleInclusive(args.get('inclusive'));
  if (inclusive === null) return null;

  const opcode = args.get('op')?.trim().toUpperCase();
  const destReg = args.get('dest')?.trim();
  const srcA = args.get('srca')?.trim();
  const srcB = args.get('srcb')?.trim();

  if (!opcode || !destReg || !srcA || !srcB) return null;
  if (!isIdentifier(opcode) || !isIdentifier(destReg) || !isIdentifier(srcA) || !isIdentifier(srcB)) return null;

  return {
    shape,
    inclusive,
    opcode,
    destReg,
    srcA,
    srcB
  };
}

export function parseGuardPragmaArgs(text: string): GuardPragmaArgs | null {
  const match = text.trim().match(/^guard\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['cond', 'op', 'dest', 'srca', 'srcb'].includes(key)) return null;
  }

  const condition = args.get('cond')?.trim();
  const opcode = args.get('op')?.trim().toUpperCase();
  const destReg = args.get('dest')?.trim();
  const srcA = args.get('srca')?.trim();
  const srcB = args.get('srcb')?.trim();

  if (!condition || !opcode || !destReg || !srcA || !srcB) return null;
  if (!isIdentifier(opcode) || !isIdentifier(destReg) || !isIdentifier(srcA) || !isIdentifier(srcB)) return null;

  return {
    condition,
    opcode,
    destReg,
    srcA,
    srcB
  };
}

export function parseCollectPragmaArgs(text: string): CollectPragmaArgs | null {
  const match = text.trim().match(/^collect\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['from', 'to', 'via', 'local', 'into', 'combine', 'path', 'max_hops'].includes(key)) return null;
  }

  const fromRaw = args.get('from');
  const viaReg = args.get('via')?.trim();
  const localReg = args.get('local')?.trim();
  const destReg = args.get('into')?.trim();
  if (!fromRaw || !viaReg || !localReg || !destReg) return null;
  if (!isIdentifier(viaReg) || !isIdentifier(localReg) || !isIdentifier(destReg)) return null;

  const from = parseCollectAxisRef(fromRaw);
  if (!from) return null;

  const toRaw = args.get('to');
  const to = toRaw
    ? parseCollectAxisRef(toRaw)
    : { axis: from.axis, index: 0 };
  if (!to) return null;
  if (to.axis !== from.axis) return null;

  const combine = (args.get('combine') ?? 'add').trim().toLowerCase();
  if (!COLLECT_COMBINE_VALUES.has(combine)) return null;

  const pathRaw = (args.get('path') ?? 'single_hop').trim().toLowerCase();
  if (pathRaw !== 'single_hop' && pathRaw !== 'multi_hop') return null;
  const path = pathRaw as CollectPragmaArgs['path'];

  const maxHopsRaw = args.get('max_hops');
  let maxHops: number | undefined;
  if (maxHopsRaw !== undefined) {
    const parsed = parseIntegerLiteral(maxHopsRaw);
    if (parsed === null || parsed <= 0) return null;
    maxHops = parsed;
  }

  return {
    from,
    to,
    viaReg,
    localReg,
    destReg,
    path,
    ...(maxHops !== undefined ? { maxHops } : {}),
    combine: combine as CollectPragmaArgs['combine']
  };
}

export function parseAccumulatePragmaArgs(text: string): AccumulatePragmaArgs | null {
  const match = text.trim().match(/^accumulate\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['pattern', 'products', 'accum', 'out', 'combine', 'steps', 'scope'].includes(key)) return null;
  }

  const patternRaw = args.get('pattern')?.trim().toLowerCase();
  if (patternRaw !== 'row' && patternRaw !== 'col' && patternRaw !== 'anti_diagonal') {
    return null;
  }
  const pattern = patternRaw as AccumulatePragmaArgs['pattern'];

  const productsReg = args.get('products')?.trim();
  const accumReg = args.get('accum')?.trim();
  const outReg = args.get('out')?.trim();
  if (!productsReg || !accumReg || !outReg) return null;
  if (!isIdentifier(productsReg) || !isIdentifier(accumReg) || !isIdentifier(outReg)) return null;

  const combineRaw = (args.get('combine') ?? 'add').trim().toLowerCase();
  if (!ACCUMULATE_COMBINE_VALUES.has(combineRaw)) return null;

  const stepsRaw = args.get('steps');
  let steps = 1;
  if (stepsRaw !== undefined) {
    const parsedSteps = parseIntegerLiteral(stepsRaw);
    if (parsedSteps === null || parsedSteps <= 0) return null;
    steps = parsedSteps;
  }

  const scopeRaw = args.get('scope');
  let scope: AccumulatePragmaArgs['scope'];
  if (scopeRaw !== undefined) {
    const parsedScope = parseAccumulateScope(scopeRaw);
    if (!parsedScope) return null;
    scope = parsedScope;
  } else {
    scope = { kind: 'all' as const };
  }

  return {
    pattern,
    productsReg,
    accumReg,
    outReg,
    combine: combineRaw as AccumulatePragmaArgs['combine'],
    steps,
    scope
  };
}

function parseConditionalSubTarget(value: string): ConditionalSubPragmaArgs['target'] | null {
  const normalized = value.trim();
  if (normalized.toLowerCase() === 'all') {
    return { kind: 'all' as const };
  }

  const rowMatch = normalized.match(/^row\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (rowMatch) {
    return { kind: 'row' as const, index: Number(rowMatch[1]) };
  }

  const colMatch = normalized.match(/^col\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (colMatch) {
    return { kind: 'col' as const, index: Number(colMatch[1]) };
  }

  const pointMatch = normalized.match(/^point\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*,\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (pointMatch) {
    return {
      kind: 'point',
      row: Number(pointMatch[1]),
      col: Number(pointMatch[2])
    };
  }

  return null;
}

export function parseConditionalSubPragmaArgs(text: string): ConditionalSubPragmaArgs | null {
  const match = text.trim().match(/^conditional_sub\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['value', 'sub', 'dest', 'target'].includes(key)) return null;
  }

  const valueReg = args.get('value')?.trim();
  const subReg = args.get('sub')?.trim();
  const destReg = args.get('dest')?.trim();
  if (!valueReg || !subReg || !destReg) return null;
  if (!isIdentifier(valueReg) || !isIdentifier(subReg) || !isIdentifier(destReg)) return null;

  const targetRaw = args.get('target')?.trim() ?? 'all';
  const target = parseConditionalSubTarget(targetRaw);
  if (!target) return null;

  return {
    valueReg,
    subReg,
    destReg,
    target
  };
}

export function parseCarryChainPragmaArgs(text: string): CarryChainPragmaArgs | null {
  const match = text.trim().match(/^carry_chain\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['src', 'carry', 'store', 'limbs', 'width', 'mask', 'row', 'start', 'dir'].includes(key)) return null;
  }

  const srcReg = args.get('src')?.trim();
  const carryReg = args.get('carry')?.trim();
  const storeSymbol = args.get('store')?.trim();
  if (!srcReg || !carryReg || !storeSymbol) return null;
  if (!isIdentifier(srcReg) || !isIdentifier(carryReg) || !isIdentifier(storeSymbol)) return null;

  const limbsRaw = args.get('limbs');
  const widthRaw = args.get('width');
  const rowRaw = args.get('row');
  if (!limbsRaw || !widthRaw || !rowRaw) return null;

  const limbs = parseIntegerLiteral(limbsRaw);
  const width = parseIntegerLiteral(widthRaw);
  const row = parseIntegerLiteral(rowRaw);
  if (limbs === null || width === null || row === null) return null;
  if (limbs <= 0 || width <= 0 || width > 30) return null;

  const startColRaw = args.get('start');
  const startCol = startColRaw ? parseIntegerLiteral(startColRaw) : 0;
  if (startCol === null) return null;

  const dirRaw = (args.get('dir') ?? 'right').trim().toLowerCase();
  if (dirRaw !== 'right' && dirRaw !== 'left') return null;

  const maskRaw = args.get('mask');
  const mask = maskRaw ? parseIntegerLiteral(maskRaw) : ((1 << width) - 1);
  if (mask === null) return null;

  return {
    srcReg,
    carryReg,
    storeSymbol,
    limbs,
    width,
    mask,
    row,
    startCol,
    direction: dirRaw as 'right' | 'left'
  };
}

export function parseNormalizePragmaArgs(text: string): NormalizePragmaArgs | null {
  const match = text.trim().match(/^normalize\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['reg', 'carry', 'width', 'mask', 'axis', 'lane', 'dir'].includes(key)) return null;
  }

  const reg = args.get('reg')?.trim();
  const carryReg = args.get('carry')?.trim();
  const widthRaw = args.get('width');
  const laneRaw = args.get('lane');
  if (!reg || !carryReg || !widthRaw || !laneRaw) return null;
  if (!isIdentifier(reg) || !isIdentifier(carryReg)) return null;

  const width = parseIntegerLiteral(widthRaw);
  const lane = parseIntegerLiteral(laneRaw);
  if (width === null || lane === null) return null;

  const axisRaw = (args.get('axis') ?? 'row').trim().toLowerCase();
  if (axisRaw !== 'row' && axisRaw !== 'col') return null;
  const axis = axisRaw as 'row' | 'col';

  const defaultDirection = axis === 'row' ? 'right' : 'down';
  const directionRaw = (args.get('dir') ?? defaultDirection).trim().toLowerCase();
  if (!['left', 'right', 'up', 'down'].includes(directionRaw)) return null;
  const direction = directionRaw as 'left' | 'right' | 'up' | 'down';

  if (axis === 'row' && !['left', 'right'].includes(direction)) return null;
  if (axis === 'col' && !['up', 'down'].includes(direction)) return null;

  const maskRaw = args.get('mask');
  const mask = maskRaw ? parseIntegerLiteral(maskRaw) : defaultMaskForWidth(width);
  if (mask === null) return null;

  return {
    reg,
    carryReg,
    width,
    mask,
    axis,
    lane,
    direction
  };
}

export function parseExtractBytesPragmaArgs(text: string): ExtractBytesPragmaArgs | null {
  const match = text.trim().match(/^extract_bytes\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['src', 'dest', 'axis', 'bytewidth', 'mask'].includes(key)) return null;
  }

  const srcReg = args.get('src')?.trim();
  const destReg = args.get('dest')?.trim();
  if (!srcReg || !destReg) return null;
  if (!isIdentifier(srcReg) || !isIdentifier(destReg)) return null;

  const axisRaw = (args.get('axis') ?? 'col').trim().toLowerCase();
  if (axisRaw !== 'row' && axisRaw !== 'col') return null;
  const axis = axisRaw as 'row' | 'col';

  const byteWidthRaw = args.get('bytewidth');
  const byteWidth = byteWidthRaw ? parseIntegerLiteral(byteWidthRaw) : 8;
  if (byteWidth === null || byteWidth <= 0 || byteWidth > 16) return null;

  const maskRaw = args.get('mask');
  const mask = maskRaw ? parseIntegerLiteral(maskRaw) : ((1 << byteWidth) - 1);
  if (mask === null) return null;

  return {
    srcReg,
    destReg,
    axis,
    byteWidth,
    mask
  };
}

export function parseTransposePragmaArgs(text: string): TransposePragmaArgs | null {
  const match = text.trim().match(/^transpose\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  const reg = args.get('reg');
  if (!reg || !isIdentifier(reg)) return null;
  if (args.size !== 1) return null;
  return { reg };
}

export function parseGatherPragmaArgs(text: string): GatherPragmaArgs | null {
  const direct = text.trim().match(
    /^gather\s*\(\s*src\s*=\s*([^,]+)\s*,\s*dest\s*=\s*(@\s*[^,]+,\s*[^,\s\)]+|\(\s*-?\d+\s*,\s*-?\d+\s*\))\s*,\s*destreg\s*=\s*([^,]+)\s*,\s*op\s*=\s*([^,]+)\s*\)\s*;?\s*$/i
  );
  if (direct) {
    const srcReg = direct[1].trim();
    const destRaw = direct[2].trim();
    const destReg = direct[3].trim();
    const operation = direct[4].trim();
    const dest = parseCoordinateLiteral(destRaw);
    if (!dest) return null;
    if (!isIdentifier(srcReg) || !isIdentifier(destReg) || !isIdentifier(operation)) return null;
    return {
      srcReg,
      dest,
      destReg,
      operation: operation.toLowerCase()
    };
  }

  const match = text.trim().match(/^gather\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['src', 'dest', 'destreg', 'op'].includes(key)) return null;
  }
  const srcReg = args.get('src');
  const destRaw = args.get('dest');
  const destReg = args.get('destreg');
  const operation = args.get('op');
  if (!srcReg || !destRaw || !destReg || !operation) return null;
  const dest = parseCoordinateLiteral(destRaw);
  if (!dest) return null;
  if (!isIdentifier(srcReg) || !isIdentifier(destReg) || !isIdentifier(operation)) return null;

  return {
    srcReg,
    dest,
    destReg,
    operation: operation.toLowerCase()
  };
}
