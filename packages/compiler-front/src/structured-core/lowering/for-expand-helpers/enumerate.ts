import { Diagnostic, ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import type { ForHeader } from '../control-flow.js';

export function enumerateForValues(
  header: ForHeader,
  lineNo: number,
  lineLength: number,
  diagnostics: Diagnostic[]
): number[] | null {
  const values: number[] = [];
  const shouldContinue = header.step > 0
    ? (value: number) => value < header.end
    : (value: number) => value > header.end;

  const maxIterations = 100_000;
  for (let value = header.start, count = 0; shouldContinue(value); value += header.step, count++) {
    if (count >= maxIterations) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        spanAt(lineNo, 1, lineLength),
        `For loop exceeds max supported iterations (${maxIterations}).`,
        'Reduce the loop range or use explicit runtime loop syntax: for R0 in range(...) at @row,col runtime { ... }.'
      ));
      return null;
    }
    values.push(value);
  }
  return values;
}
