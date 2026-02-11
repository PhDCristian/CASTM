import {
  AstProgram,
  CompileOptions,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  makeDiagnostic,
  spanAt
} from '@openedge/compiler-ir';
import { getTargetProfile } from '@openedge/lang-spec';

export interface ResolvedGridTarget {
  targetProfileId: string;
  grid: GridSpec;
}

export function resolveGrid(
  ast: AstProgram,
  options: CompileOptions,
  diagnostics: Diagnostic[]
): ResolvedGridTarget | null {
  const targetProfileId = options.targetProfile ?? ast.targetProfileId;
  if (!targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing target profile for analysis.',
      'Set target in source (target "...") or CompileOptions.targetProfile.'
    ));
    return null;
  }

  const profile = getTargetProfile(targetProfileId);
  if (!profile) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnknownTargetProfile,
      'error',
      spanAt(1, 1, 1),
      `Unknown target profile '${targetProfileId}'.`,
      'Check @openedge/lang-spec target-profiles catalog.'
    ));
    return null;
  }

  const rows = options.grid?.rows ?? profile.grid.rows;
  const cols = options.grid?.cols ?? profile.grid.cols;
  const topology = options.grid?.topology ?? profile.grid.topology;

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidGridSpec,
      'error',
      spanAt(1, 1, 1),
      `Invalid grid dimensions rows=${rows}, cols=${cols}.`,
      'Rows and cols must be positive integers.'
    ));
    return null;
  }

  return {
    targetProfileId,
    grid: {
      rows,
      cols,
      topology,
      wrapPolicy: topology === 'torus' ? 'wrap' : 'clamp'
    }
  };
}
