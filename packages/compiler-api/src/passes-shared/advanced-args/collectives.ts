import {
  isIdentifier,
  parseKeyValueArgs,
  splitPositionalArgs
} from '../pragma-args-utils.js';
import { parseCoordinateLiteral } from '../route-args.js';
import {
  GatherPragmaArgs,
  StencilPragmaArgs,
  TransposePragmaArgs
} from './types.js';

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
