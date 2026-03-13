import { isIdentifier, parseKeyValueArgs } from '../pragma-args-utils.js';
import {
  AllreducePragmaArgs,
  ReducePragmaArgs,
  ScanPragmaArgs
} from './types.js';

export function parseScanPragmaArgs(text: string): ScanPragmaArgs | null {
  const match = text.trim().match(/^scan\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['op', 'src', 'dest', 'dir', 'mode'].includes(key)) return null;
  }

  const operation = args.get('op')?.toLowerCase();
  const srcReg = args.get('src');
  const dstReg = args.get('dest');
  const direction = args.get('dir')?.toLowerCase();
  const mode = (args.get('mode') ?? 'inclusive').toLowerCase();
  if (!operation || !srcReg || !dstReg || !direction) return null;

  if (!isIdentifier(srcReg) || !isIdentifier(dstReg)) {
    return null;
  }

  if (!['left', 'right', 'up', 'down'].includes(direction)) {
    return null;
  }

  if (mode !== 'inclusive' && mode !== 'exclusive') {
    return null;
  }

  return {
    operation,
    srcReg,
    dstReg,
    direction: direction as 'left' | 'right' | 'up' | 'down',
    mode: mode as 'inclusive' | 'exclusive'
  };
}

export function parseReducePragmaArgs(text: string): ReducePragmaArgs | null {
  const match = text.trim().match(/^reduce\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['op', 'dest', 'src', 'axis'].includes(key)) return null;
  }
  const operation = args.get('op');
  const destReg = args.get('dest');
  const srcReg = args.get('src');
  const axis = args.get('axis')?.toLowerCase();
  if (!operation || !destReg || !srcReg) return null;
  if (axis && axis !== 'row' && axis !== 'col') return null;

  return {
    operation: operation.toLowerCase(),
    destReg,
    srcReg,
    axis: (axis as 'row' | 'col' | undefined) ?? 'row'
  };
}

export function parseAllreducePragmaArgs(text: string): AllreducePragmaArgs | null {
  const match = text.trim().match(/^allreduce\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['op', 'dest', 'src', 'axis'].includes(key)) return null;
  }
  const operation = args.get('op');
  const destReg = args.get('dest');
  const srcReg = args.get('src');
  const axis = args.get('axis')?.toLowerCase();
  if (!operation || !destReg || !srcReg) return null;
  if (axis && axis !== 'row' && axis !== 'col') return null;

  return {
    operation: operation.toLowerCase(),
    destReg,
    srcReg,
    axis: (axis as 'row' | 'col' | undefined) ?? 'row'
  };
}
