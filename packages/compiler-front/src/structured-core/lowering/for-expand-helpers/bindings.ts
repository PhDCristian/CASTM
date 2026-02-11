import type { SourceLineEntry } from '../../parser-utils/blocks.js';
import { applyBindings } from '../../parser-utils/numbers.js';

export function instantiateEntriesWithBindings(
  body: SourceLineEntry[],
  bindings: ReadonlyMap<string, number>
): SourceLineEntry[] {
  if (bindings.size === 0) {
    return body.map((entry) => ({
      lineNo: entry.lineNo,
      rawLine: entry.rawLine,
      cleanLine: entry.cleanLine
    }));
  }

  return body.map((entry) => ({
    lineNo: entry.lineNo,
    rawLine: applyBindings(entry.rawLine, bindings),
    cleanLine: applyBindings(entry.cleanLine, bindings)
  }));
}
