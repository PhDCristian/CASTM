import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import { getTargetProfile, resolveTargetProfileId } from '@castm/lang-spec';

export interface ResolvedGridTarget {
  targetProfileId: string;
  grid: GridSpec;
}

export function resolveGrid(
  ast: AstProgram,
  diagnostics: Diagnostic[]
): ResolvedGridTarget | null {
  const targetRaw = ast.target?.id ?? ast.targetProfileId;
  if (!targetRaw) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing target profile for analysis.',
      'Set target in source, for example: target base;'
    ));
    return null;
  }

  const targetProfileId = resolveTargetProfileId(targetRaw);
  if (!targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnknownTargetProfile,
      'error',
      ast.target?.span ?? spanAt(1, 1, 1),
      `Unknown target profile '${targetRaw}'.`,
      'Use a known target id (uma-cgra-base, uma-cgra-mesh) or alias (base, mesh).'
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
      'Check @castm/lang-spec target-profiles catalog.'
    ));
    return null;
  }

  const rows = ast.build?.grid?.rows ?? profile.grid.rows;
  const cols = ast.build?.grid?.cols ?? profile.grid.cols;
  const topology = ast.build?.grid?.topology ?? profile.grid.topology;

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidGridSpec,
      'error',
      ast.build?.span ?? spanAt(1, 1, 1),
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
