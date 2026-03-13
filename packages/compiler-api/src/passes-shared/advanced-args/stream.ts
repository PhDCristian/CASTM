import {
  isIdentifier,
  parseIntegerLiteral,
  parseKeyValueArgs
} from '../pragma-args-utils.js';
import {
  StreamLoadPragmaArgs,
  StreamStorePragmaArgs
} from './types.js';

export function parseStreamLoadPragmaArgs(text: string): StreamLoadPragmaArgs | null {
  const match = text.trim().match(/^stream_load\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;

  for (const key of args.keys()) {
    if (key !== 'dest' && key !== 'row' && key !== 'count') {
      return null;
    }
  }

  const destReg = args.get('dest');
  if (!destReg || !isIdentifier(destReg)) return null;

  const rowRaw = args.get('row');
  const row = rowRaw === undefined ? 0 : parseIntegerLiteral(rowRaw);
  if (row === null) return null;

  const countRaw = args.get('count');
  const count = countRaw === undefined ? 1 : parseIntegerLiteral(countRaw);
  if (count === null) return null;

  return {
    destReg,
    row,
    count
  };
}

export function parseStreamStorePragmaArgs(text: string): StreamStorePragmaArgs | null {
  const match = text.trim().match(/^stream_store\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;

  for (const key of args.keys()) {
    if (key !== 'src' && key !== 'row' && key !== 'count') {
      return null;
    }
  }

  const srcReg = args.get('src');
  if (!srcReg || !isIdentifier(srcReg)) return null;

  const rowRaw = args.get('row');
  const row = rowRaw === undefined ? 0 : parseIntegerLiteral(rowRaw);
  if (row === null) return null;

  const countRaw = args.get('count');
  const count = countRaw === undefined ? 1 : parseIntegerLiteral(countRaw);
  if (count === null) return null;

  return {
    srcReg,
    row,
    count
  };
}
