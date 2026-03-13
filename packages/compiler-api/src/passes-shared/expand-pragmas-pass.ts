import {
  AstProgram,
  CompilerPass,
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  makeDiagnostic
} from '@castm/compiler-ir';
import { parseLatencyHidePragmaArgs } from './advanced-args.js';
import { cloneAst } from './ast-utils.js';
import { extractPragmaName } from './pragma-args-utils.js';
import {
  ExpandPragmaContext,
  NOOP_PRAGMAS,
  PRAGMA_HANDLERS,
  SUPPORTED_PRAGMAS
} from './expand-pragmas-handlers.js';
import { applyLatencyHide } from './expand-pragmas/latency-hide.js';

export function createExpandPragmasPass(strictUnsupported: boolean, grid: GridSpec): CompilerPass<AstProgram, AstProgram> {
  return {
    name: 'expand-pragmas',
    run(input) {
      const output = cloneAst(input);
      const diagnostics: Diagnostic[] = [];

      if (!output.kernel) {
        return { output, diagnostics };
      }

      const cyclesByAnchor = new Map<number, CycleAst[]>();
      const totalCycles = output.kernel.cycles.length;
      const latencyHideWindows: number[] = [];

      const normalizeAnchor = (anchorCycleIndex: number | undefined): number => {
        if (!Number.isInteger(anchorCycleIndex)) return 0;
        if (anchorCycleIndex! < 0) return 0;
        if (anchorCycleIndex! > totalCycles) return totalCycles;
        return anchorCycleIndex!;
      };

      for (const pragma of output.kernel.pragmas) {
        const name = extractPragmaName(pragma.text);
        const handler = PRAGMA_HANDLERS.get(name);
        const anchor = normalizeAnchor(pragma.anchorCycleIndex);
        const generatedCycles = cyclesByAnchor.get(anchor) ?? [];
        if (!cyclesByAnchor.has(anchor)) {
          cyclesByAnchor.set(anchor, generatedCycles);
        }
        const context: ExpandPragmaContext = {
          grid,
          generatedCycles,
          diagnostics
        };

        if (name === 'latency_hide') {
          const parsed = parseLatencyHidePragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid latency_hide statement syntax: '${pragma.text}'.`,
              'Use latency_hide(window=1[, mode=conservative]).'
            ));
            continue;
          }
          latencyHideWindows.push(parsed.window);
          continue;
        }

        if (handler) {
          const prevLen = generatedCycles.length;
          handler(pragma, context);
          // Propagate label to first generated cycle
          if (pragma.label && generatedCycles.length > prevLen) {
            generatedCycles[prevLen].label = pragma.label;
          }
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

      const hasGeneratedCycles = [...cyclesByAnchor.values()].some((bucket) => bucket.length > 0);
      if (hasGeneratedCycles) {
        const merged: CycleAst[] = [];
        for (let cycleIndex = 0; cycleIndex <= totalCycles; cycleIndex++) {
          const anchoredCycles = cyclesByAnchor.get(cycleIndex);
          if (anchoredCycles && anchoredCycles.length > 0) {
            merged.push(...anchoredCycles);
          }
          if (cycleIndex < totalCycles) {
            merged.push(output.kernel.cycles[cycleIndex]);
          }
        }

        output.kernel.cycles = merged.map((cycle, index) => ({
          ...cycle,
          index
        }));
      }

      if (latencyHideWindows.length > 0) {
        output.kernel.cycles = applyLatencyHide(
          output.kernel.cycles,
          grid,
          Math.max(...latencyHideWindows)
        );
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
