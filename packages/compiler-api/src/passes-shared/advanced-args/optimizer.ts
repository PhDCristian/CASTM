import {
  parseIntegerLiteral,
  parseKeyValueArgs
} from '../pragma-args-utils.js';
import { LatencyHidePragmaArgs } from './types.js';

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
  if (window === null || window <= 0 || window > 8) return null;

  const modeRaw = (args.get('mode') ?? 'conservative').trim().toLowerCase();
  if (modeRaw !== 'conservative') return null;

  return {
    window,
    mode: 'conservative'
  };
}
