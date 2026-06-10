import {
  CompilerPass,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  HirProgram,
  makeDiagnostic
} from '@castm/compiler-ir';

export function createValidateGridPass(grid: GridSpec): CompilerPass<HirProgram, HirProgram> {
  return {
    name: 'validate-grid',
    run(input) {
      const diagnostics: Diagnostic[] = [];

      for (const bundle of input.bundles) {
        const seen = new Set<string>();
        for (const op of bundle.operations) {
          if (op.row < 0 || op.row >= grid.rows || op.col < 0 || op.col >= grid.cols) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.CoordinateOutOfBounds,
              'error',
              op.span,
              `Operation at @${op.row},${op.col} is out of bounds for ${grid.rows}x${grid.cols}.`
            ));
          }

          const key = `${bundle.index}:${op.row}:${op.col}`;
          if (seen.has(key)) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.Collision,
              'error',
              op.span,
              `Duplicate operation at @${op.row},${op.col} in bundle ${bundle.index}.`
            ));
          }
          seen.add(key);
        }
      }

      return { output: input, diagnostics };
    }
  };
}
