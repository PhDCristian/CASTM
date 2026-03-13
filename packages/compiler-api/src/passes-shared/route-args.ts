import { isIdentifier, parseKeyValueArgs, splitPositionalArgs } from './pragma-args-utils.js';

export interface RoutePoint {
  row: number;
  col: number;
}

export interface RouteCustomOp {
  opcode: string;
  dest: string;
  srcA: string;
  srcB: string;
}

export interface RoutePragmaArgs {
  src: RoutePoint;
  dst: RoutePoint;
  payload: string;
  accum: string;
  destReg?: string;
  customOp?: RouteCustomOp;
}

function skipWhitespace(text: string, index: number): number {
  let pos = index;
  while (pos < text.length && /\s/.test(text[pos])) pos++;
  return pos;
}

function readInteger(text: string, index: number): { value: number; next: number } | null {
  const match = text.slice(index).match(/^-?\d+/);
  if (!match) return null;
  return {
    value: parseInt(match[0], 10),
    next: index + match[0].length
  };
}

function parseRouteCoordinate(text: string, index: number): { point: RoutePoint; next: number } | null {
  let pos = skipWhitespace(text, index);
  if (pos >= text.length) return null;

  if (text[pos] !== '@') return null;
  pos++;
  pos = skipWhitespace(text, pos);
  const row = readInteger(text, pos);
  if (!row) return null;
  pos = skipWhitespace(text, row.next);
  if (text[pos] !== ',') return null;
  pos++;
  pos = skipWhitespace(text, pos);
  const col = readInteger(text, pos);
  if (!col) return null;
  return {
    point: { row: row.value, col: col.value },
    next: col.next
  };

}

export function parseCoordinateLiteral(text: string): RoutePoint | null {
  const parsed = parseRouteCoordinate(text.trim(), 0);
  if (!parsed) return null;
  const tail = text.slice(parsed.next).trim();
  if (tail.length > 0) return null;
  return parsed.point;
}

function parseRouteCustomOp(text: string): RouteCustomOp | null {
  const match = text.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.+)\)\s*$/);
  if (!match) return null;
  const operands = splitPositionalArgs(match[2]);
  if (!operands || operands.length !== 3) return null;
  const opcode = match[1].trim().toUpperCase();
  const dest = operands[0].trim();
  const srcA = operands[1].trim();
  const srcB = operands[2].trim();
  if (!dest || !srcA || !srcB) return null;
  return { opcode, dest, srcA, srcB };
}

export function parseRoutePragmaArgs(text: string): RoutePragmaArgs | null {
  const match = text
    .trim()
    .match(/^route\s*\(\s*(@\s*[^,]+\s*,\s*[^,\s\)]+)\s*->\s*(@\s*[^,]+\s*,\s*[^,\s\)]+)\s*,\s*(.+)\)\s*;?\s*$/i);
  if (!match) return null;

  const src = parseCoordinateLiteral(match[1]);
  const dst = parseCoordinateLiteral(match[2]);
  if (!src || !dst) return null;

  const args = parseKeyValueArgs(match[3]);
  if (!args) return null;

  const payload = args.get('payload');
  if (!payload || !isIdentifier(payload)) return null;

  const accum = args.get('accum');
  if (accum && isIdentifier(accum) && args.size === 2) {
    return { src, dst, payload, accum };
  }

  const destReg = args.get('dest');
  const op = args.get('op');
  if (!destReg || !op || !isIdentifier(destReg)) return null;
  const customOp = parseRouteCustomOp(op);
  if (!customOp) return null;

  return {
    src,
    dst,
    payload,
    accum: destReg,
    destReg,
    customOp
  };
}
