import {
  AstProgram,
  CompilerPass,
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  makeDiagnostic
} from '@castm/compiler-ir';
import { parseLatencyHideAdvancedStatementArgs } from './advanced-args.js';
import { cloneAst } from './ast-utils.js';
import { extractAdvancedStatementName } from './advanced-statement-args-utils.js';
import {
  ExpandAdvancedStatementContext,
  NOOP_ADVANCED_STATEMENTS,
  PRAGMA_HANDLERS,
  SUPPORTED_ADVANCED_STATEMENTS
} from './expand-advanced-statements-handlers.js';
import { applyLatencyHide } from './expand-advanced-statements/latency-hide.js';

export function createExpandAdvancedStatementsPass(strictUnsupported: boolean, grid: GridSpec): CompilerPass<AstProgram, AstProgram> {
  return {
    name: 'expand-advanced-statements',
    run(input) {
      const output = cloneAst(input);
      const diagnostics: Diagnostic[] = [];

      if (!output.kernel) {
        return { output, diagnostics };
      }

      const bundlesByAnchor = new Map<number, BundleAst[]>();
      const totalBundles = output.kernel.bundles.length;
      const latencyHideWindows: number[] = [];

      const normalizeAnchor = (anchorBundleIndex: number | undefined): number => {
        if (!Number.isInteger(anchorBundleIndex)) return 0;
        if (anchorBundleIndex! < 0) return 0;
        if (anchorBundleIndex! > totalBundles) return totalBundles;
        return anchorBundleIndex!;
      };

      for (const advancedStatement of output.kernel.advancedStatements) {
        const name = extractAdvancedStatementName(advancedStatement.text);
        const handler = PRAGMA_HANDLERS.get(name);
        const anchor = normalizeAnchor(advancedStatement.anchorBundleIndex);
        const generatedBundles = bundlesByAnchor.get(anchor) ?? [];
        if (!bundlesByAnchor.has(anchor)) {
          bundlesByAnchor.set(anchor, generatedBundles);
        }
        const context: ExpandAdvancedStatementContext = {
          grid,
          generatedBundles,
          diagnostics
        };

        if (name === 'latency_hide') {
          const parsed = parseLatencyHideAdvancedStatementArgs(advancedStatement.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              advancedStatement.span,
              `Invalid latency_hide statement syntax: '${advancedStatement.text}'.`,
              'Use latency_hide(window=1[, mode=conservative]).'
            ));
            continue;
          }
          latencyHideWindows.push(parsed.window);
          continue;
        }

        if (handler) {
          const prevLen = generatedBundles.length;
          handler(advancedStatement, context);
          // Propagate label to first generated bundle
          if (advancedStatement.label && generatedBundles.length > prevLen) {
            generatedBundles[prevLen].label = advancedStatement.label;
          }
          continue;
        }

        if (NOOP_ADVANCED_STATEMENTS.has(name)) continue;
        if (SUPPORTED_ADVANCED_STATEMENTS.has(name)) continue;
        if (!strictUnsupported) continue;

        diagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.UnsupportedAdvancedStatement,
          'error',
          advancedStatement.span,
          `Unsupported advancedStatement '${name}' in the current baseline.`,
          'Use CompileOptions.strictUnsupported=false to allow transitional compilation.'
        ));
      }

      const hasGeneratedBundles = [...bundlesByAnchor.values()].some((bucket) => bucket.length > 0);
      if (hasGeneratedBundles) {
        const merged: BundleAst[] = [];
        for (let bundleIndex = 0; bundleIndex <= totalBundles; bundleIndex++) {
          const anchoredBundles = bundlesByAnchor.get(bundleIndex);
          if (anchoredBundles && anchoredBundles.length > 0) {
            merged.push(...anchoredBundles);
          }
          if (bundleIndex < totalBundles) {
            merged.push(output.kernel.bundles[bundleIndex]);
          }
        }

        output.kernel.bundles = merged.map((bundle, index) => ({
          ...bundle,
          index
        }));
      }

      if (latencyHideWindows.length > 0) {
        output.kernel.bundles = applyLatencyHide(
          output.kernel.bundles,
          grid,
          Math.max(...latencyHideWindows)
        );
      }

      return { output, diagnostics };
    }
  };
}

export const expandAdvancedStatementsPass = createExpandAdvancedStatementsPass(false, {
  rows: 4,
  cols: 4,
  topology: 'torus',
  wrapPolicy: 'wrap'
});
