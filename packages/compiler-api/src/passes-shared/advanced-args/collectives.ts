import {
  isIdentifier,
  parseIntegerLiteral,
  parseKeyValueArgs,
  splitPositionalArgs
} from '../pragma-args-utils.js';
import { parseCoordinateLiteral } from '../route-args.js';
import {
  CollectAxisRef,
  CollectPragmaArgs,
  GuardPragmaArgs,
  GatherPragmaArgs,
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

function parseCollectAxisRef(value: string): CollectAxisRef | null {
  const match = value.trim().match(/^(row|col)\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (!match) return null;
  return {
    axis: match[1].toLowerCase() as 'row' | 'col',
    index: Number(match[2])
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
    if (!['from', 'to', 'via', 'local', 'into', 'combine'].includes(key)) return null;
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

  return {
    from,
    to,
    viaReg,
    localReg,
    destReg,
    combine: combine as CollectPragmaArgs['combine']
  };
}

function defaultMaskForWidth(width: number): number | null {
  if (!Number.isInteger(width) || width <= 0 || width >= 31) return null;
  return (1 << width) - 1;
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
