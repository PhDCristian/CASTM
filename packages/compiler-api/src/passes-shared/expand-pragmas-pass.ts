import {
  AstProgram,
  CompilerPass,
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { cloneAst } from './ast-utils.js';
import { extractPragmaName } from './pragma-args-utils.js';
import {
  ExpandPragmaContext,
  NOOP_PRAGMAS,
  PRAGMA_HANDLERS,
  SUPPORTED_PRAGMAS
} from './expand-pragmas-handlers.js';

export function createExpandPragmasPass(strictUnsupported: boolean, grid: GridSpec): CompilerPass<AstProgram, AstProgram> {
  return {
    name: 'expand-pragmas',
    run(input) {
      const output = cloneAst(input);
      const diagnostics: Diagnostic[] = [];

      if (!output.kernel) {
        return { output, diagnostics };
      }

      const generatedCycles: CycleAst[] = [];
      const context: ExpandPragmaContext = {
        grid,
        generatedCycles,
        diagnostics
      };

      for (const pragma of output.kernel.pragmas) {
        const name = extractPragmaName(pragma.text);
        const handler = PRAGMA_HANDLERS.get(name);

        if (handler) {
          handler(pragma, context);
          continue;
        }

        if (NOOP_PRAGMAS.has(name)) continue;
        if (SUPPORTED_PRAGMAS.has(name)) continue;
        if (!strictUnsupported) continue;

        diagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.UnsupportedPragma,
          'error',
          pragma.span,
          `Unsupported pragma '${name}' in the current baseline.`,
          'Use CompileOptions.strictUnsupported=false to allow transitional compilation.'
        ));
      }

      if (generatedCycles.length > 0) {
        const merged = [...generatedCycles, ...output.kernel.cycles];
        output.kernel.cycles = merged.map((cycle, index) => ({
          ...cycle,
          index
        }));
      }

      return { output, diagnostics };
    }
  };
}

export const expandPragmasPass = createExpandPragmasPass(false, {
  rows: 4,
  cols: 4,
  topology: 'torus',
  wrapPolicy: 'wrap'
});
