import {
  isIdentifier,
  parseIntegerLiteral,
  parseKeyValueArgs
} from '../pragma-args-utils.js';
import { LatencyHidePragmaArgs, StashPragmaArgs, StashTarget } from './types.js';

const LATENCY_HIDE_MAX_WINDOW = 256;

export function parseLatencyHidePragmaArgs(text: string): LatencyHidePragmaArgs | null {
  const match = text.trim().match(/^latency_hide\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;

  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['window', 'mode'].includes(key)) return null;
  }

  const windowRaw = args.get('window')?.trim() ?? '1';
  const window = parseIntegerLiteral(windowRaw);
  if (window === null || window <= 0 || window > LATENCY_HIDE_MAX_WINDOW) return null;

  const modeRaw = (args.get('mode') ?? 'conservative').trim().toLowerCase();
  if (modeRaw !== 'conservative') return null;

  return {
    window,
    mode: 'conservative'
  };
}

function parseStashTarget(raw: string): StashTarget | null {
  const normalized = raw.trim();
  if (normalized.toLowerCase() === 'all') {
    return { kind: 'all' };
  }

  const rowMatch = normalized.match(/^row\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (rowMatch) {
    return { kind: 'row', index: Number(rowMatch[1]) };
  }

  const colMatch = normalized.match(/^col\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (colMatch) {
    return { kind: 'col', index: Number(colMatch[1]) };
  }

  const pointMatch = normalized.match(/^point\s*\(\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*,\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*\)$/i);
  if (!pointMatch) return null;
  return {
    kind: 'point',
    row: Number(pointMatch[1]),
    col: Number(pointMatch[2])
  };
}

export function parseStashPragmaArgs(text: string): StashPragmaArgs | null {
  const match = text.trim().match(/^stash\s*\((.+)\)\s*;?\s*$/i);
  if (!match) return null;

  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  for (const key of args.keys()) {
    if (!['action', 'reg', 'addr', 'target'].includes(key)) return null;
  }

  const actionRaw = args.get('action')?.trim().toLowerCase();
  if (actionRaw !== 'save' && actionRaw !== 'restore') return null;

  const reg = args.get('reg')?.trim();
  const addr = args.get('addr')?.trim();
  if (!reg || !addr || !isIdentifier(reg)) return null;

  const targetRaw = args.get('target')?.trim() ?? 'all';
  const target = parseStashTarget(targetRaw);
  if (!target) return null;

  return {
    action: actionRaw,
    reg,
    addr,
    target
  };
}
