import { parseIntegerLiteral, parseKeyValueArgs } from '../pragma-args-utils.js';
import { RotateShiftPragmaArgs } from './types.js';

export function parseRotateShiftPragmaArgs(text: string, pragmaName: 'rotate' | 'shift'): RotateShiftPragmaArgs | null {
  const match = text.trim().match(new RegExp(`^${pragmaName}\\s*\\((.+)\\)\\s*;?\\s*$`, 'i'));
  if (!match) return null;
  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;

  const reg = args.get('reg');
  const direction = args.get('direction')?.toLowerCase();
  if (!reg || (direction !== 'left' && direction !== 'right')) {
    return null;
  }

  const rawDistance = args.get('distance');
  const distance = rawDistance ? parseIntegerLiteral(rawDistance) : 1;
  if (distance === null || distance <= 0) return null;

  const fillRaw = args.get('fill');
  let fill: number | undefined;
  if (fillRaw !== undefined) {
    const parsedFill = parseIntegerLiteral(fillRaw);
    if (parsedFill === null) {
      return null;
    }
    fill = parsedFill;
  }

  return {
    reg,
    direction,
    distance,
    fill
  };
}
