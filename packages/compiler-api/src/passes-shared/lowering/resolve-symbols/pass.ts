import {
  AstProgram,
  CompilerPass,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  HirBundle,
  HirProgram,
  makeDiagnostic
} from '@castm/compiler-ir';
import { lowerBundleStatements } from './bundle-lowering.js';

function collectLabels(ast: AstProgram, diagnostics: Diagnostic[]): Map<string, number> {
  const labels = new Map<string, number>();
  for (const bundle of ast.kernel?.bundles ?? []) {
    if (!bundle.label) continue;
    if (labels.has(bundle.label)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.DuplicateLabel,
        'error',
        bundle.span,
        `Duplicate bundle label '${bundle.label}'.`,
        'Use unique labels for each labeled bundle.'
      ));
      continue;
    }
    labels.set(bundle.label, bundle.index);
  }
  return labels;
}

export function createResolveSymbolsPass(targetProfileId: string, grid: GridSpec): CompilerPass<AstProgram, HirProgram> {
  return {
    name: 'resolve-symbols',
    run(input) {
      const diagnostics: Diagnostic[] = [];

      const kernel = input.kernel;
      const bundles: HirBundle[] = [];
      if (!kernel) {
        return {
          output: {
            targetProfileId,
            grid,
            bundles: []
          },
          diagnostics
        };
      }

      const labels = collectLabels(input, diagnostics);

      for (const bundle of kernel.bundles) {
        bundles.push({
          index: bundle.index,
          operations: lowerBundleStatements(bundle.index, bundle.statements, grid, labels, diagnostics),
          span: { ...bundle.span }
        });
      }

      return {
        output: {
          targetProfileId,
          grid,
          bundles
        },
        diagnostics
      };
    }
  };
}
