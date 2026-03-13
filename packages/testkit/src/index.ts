import { compile } from '@castm/compiler-api';
import { CompileOptions, CompileResult, Diagnostic } from '@castm/compiler-ir';

export function compileFixture(source: string, options: CompileOptions = {}): CompileResult {
  return compile(source, { ...options, emitArtifacts: ['ast', 'hir', 'mir', 'csv'] });
}

export function hasErrorCode(diagnostics: Diagnostic[], code: string): boolean {
  return diagnostics.some((d) => d.code === code && d.severity === 'error');
}

export function collectErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => d.severity === 'error');
}
