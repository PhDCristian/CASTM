import {
  AstProgram,
  CompilerPass,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  HirCycle,
  HirProgram,
  makeDiagnostic
} from '@castm/compiler-ir';
import { lowerCycleStatements } from './cycle-lowering.js';

function collectLabels(ast: AstProgram, diagnostics: Diagnostic[]): Map<string, number> {
  const labels = new Map<string, number>();
  for (const cycle of ast.kernel?.cycles ?? []) {
    if (!cycle.label) continue;
    if (labels.has(cycle.label)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.DuplicateLabel,
        'error',
        cycle.span,
        `Duplicate cycle label '${cycle.label}'.`,
        'Use unique labels for each labeled cycle.'
      ));
      continue;
    }
    labels.set(cycle.label, cycle.index);
  }
  return labels;
}

export function createResolveSymbolsPass(targetProfileId: string, grid: GridSpec): CompilerPass<AstProgram, HirProgram> {
  return {
    name: 'resolve-symbols',
    run(input) {
      const diagnostics: Diagnostic[] = [];

      const kernel = input.kernel;
      const cycles: HirCycle[] = [];
      if (!kernel) {
        return {
          output: {
            targetProfileId,
            grid,
            cycles: []
          },
          diagnostics
        };
      }

      const labels = collectLabels(input, diagnostics);

      for (const cycle of kernel.cycles) {
        cycles.push({
          index: cycle.index,
          operations: lowerCycleStatements(cycle.index, cycle.statements, grid, labels, diagnostics),
          span: { ...cycle.span }
        });
      }

      return {
        output: {
          targetProfileId,
          grid,
          cycles
        },
        diagnostics
      };
    }
  };
}
