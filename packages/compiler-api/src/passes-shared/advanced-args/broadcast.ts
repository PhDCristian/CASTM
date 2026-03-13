import { isIdentifier, parseKeyValueArgs } from '../pragma-args-utils.js';
import { parseCoordinateLiteral } from '../route-args.js';
import { BroadcastPragmaArgs } from './types.js';

export function parseBroadcastPragmaArgs(text: string): BroadcastPragmaArgs | null {
  const direct = text.trim().match(
    /^broadcast\s*\(\s*value\s*=\s*([^,]+)\s*,\s*from\s*=\s*(@\s*[^,]+,\s*[^,\s\)]+|\(\s*-?\d+\s*,\s*-?\d+\s*\))\s*,\s*to\s*=\s*(row|column|all)\s*\)\s*;?\s*$/i
  );
  if (direct) {
    const valueReg = direct[1].trim();
    const fromRaw = direct[2].trim();
    const toRaw = direct[3].toLowerCase();
    if (!isIdentifier(valueReg)) return null;
    const from = parseCoordinateLiteral(fromRaw);
    if (!from) return null;
    return {
      valueReg,
      from,
      scope: toRaw as 'row' | 'column' | 'all'
    };
  }

  const fallback = text.trim().match(/^broadcast\s*\((.+)\)\s*;?\s*$/i);
  if (!fallback) return null;
  const args = parseKeyValueArgs(fallback[1]);
  if (!args) return null;

  const valueReg = args.get('value');
  const fromRaw = args.get('from');
  const toRaw = args.get('to')?.toLowerCase();
  if (!valueReg || !fromRaw || !toRaw) return null;
  if (!isIdentifier(valueReg)) return null;
  if (toRaw !== 'row' && toRaw !== 'column' && toRaw !== 'all') return null;
  const from = parseCoordinateLiteral(fromRaw);
  if (!from) return null;
  return {
    valueReg,
    from,
    scope: toRaw as 'row' | 'column' | 'all'
  };
}
