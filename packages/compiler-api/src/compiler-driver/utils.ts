import { Diagnostic } from '@openedge/compiler-ir';

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
