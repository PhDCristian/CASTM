import {
  Diagnostic,
  ErrorCodes,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  compileWithSourceMap,
  hashCastmSource
} from './compiler-driver/source-map-driver.js';
import {
  affectedBundleIndices,
  canPatchEntries,
  canonicalizeBundleMatrix,
  groupBundlesByExactSpan,
  matrixFromProgram,
  mutateMatrix,
  normalizeMovePatchInstruction,
  patchAffectsBundle,
  patchBundleIndex,
  spanKey
} from './visual-patch-matrix.js';
import {
  applyLineEdits,
  changedLineRangesForReplacements,
  diffPreview,
  indentReplacement,
  leadingIndentForSpan,
  replaceSpanByWholeLines,
  tryBuildDirectMoveEdits
} from './visual-patch-lines.js';
import type {
  ApplyVisualPatchOptions,
  CastmPatchResult,
  CastmVisualPatch
} from './visual-patch-types.js';

export type {
  ApplyVisualPatchOptions,
  CastmBundleMatrix,
  CastmLineRange,
  CastmMatrixCell,
  CastmPatchResult,
  CastmVisualPatch
} from './visual-patch-types.js';
export { canonicalizeBundleMatrix } from './visual-patch-matrix.js';

function diagnostic(span: SourceSpan, message: string, hint?: string): Diagnostic {
  return makeDiagnostic(ErrorCodes.Semantic.UnsupportedOperation, 'error', span, message, hint);
}

export function applyVisualPatch(
  source: string,
  patch: CastmVisualPatch,
  options: ApplyVisualPatchOptions = {}
): CastmPatchResult {
  const sourceHash = hashCastmSource(source);
  if (options.expectedSourceHash && options.expectedSourceHash !== sourceHash) {
    return {
      status: 'staleArtifacts',
      diagnostics: [diagnostic({ startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 }, 'CASTM source changed since the visual artifacts were produced.')]
    };
  }

  const artifacts = compileWithSourceMap(source);
  if (!artifacts.success || !artifacts.analysisResult || !artifacts.emitResult?.sourceMap) {
    return { status: 'invalid', diagnostics: artifacts.diagnostics };
  }

  const program = artifacts.analysisResult.lir ?? artifacts.analysisResult.mir;
  const kernelBundles = artifacts.analysisResult.ast?.kernel?.bundles ?? [];
  const primaryBundleIndex = patchBundleIndex(patch);
  const primaryBundle = kernelBundles.find((bundle) => bundle.index === primaryBundleIndex);
  if (!program || !primaryBundle) {
    return {
      status: 'conflict',
      diagnostics: [diagnostic(artifacts.parseResult.ast?.span ?? { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 }, `Bundle ${primaryBundleIndex} is not patchable.`)]
    };
  }

  const sourceMatrix = patch.kind === 'move-slot'
    ? matrixFromProgram(
      program,
      patch.from.bundle,
      kernelBundles.find((bundle) => bundle.index === patch.from.bundle)?.label
    )
    : null;
  const normalizedPatch = normalizeMovePatchInstruction(patch, sourceMatrix);
  const sourceMap = artifacts.emitResult.sourceMap;

  if (normalizedPatch.kind === 'move-slot') {
    const directMove = tryBuildDirectMoveEdits(source, normalizedPatch, sourceMap, kernelBundles);
    if (directMove) {
      const updatedSource = applyLineEdits(source, directMove.edits);
      const previewDiff = diffPreview(source, updatedSource);

      if (options.previewOnly) {
        return {
          status: 'preview',
          updatedSource,
          previewDiff,
          sourceHash,
          changedLineRanges: directMove.changedLineRanges
        };
      }

      const updatedArtifacts = compileWithSourceMap(updatedSource);
      if (!updatedArtifacts.success) {
        return {
          status: 'verificationFailed',
          diagnostics: updatedArtifacts.diagnostics
        };
      }

      return {
        status: 'applied',
        updatedSource,
        updatedArtifacts,
        previewDiff,
        sourceHash: hashCastmSource(updatedSource),
        changedLineRanges: directMove.changedLineRanges
      };
    }
  }

  const requestedBundleIndices = affectedBundleIndices(normalizedPatch);
  const materializedBundleIndices = new Set<number>();
  for (const bundleIndex of requestedBundleIndices) {
    const group = groupBundlesByExactSpan(kernelBundles, bundleIndex);
    if (group.length === 0) materializedBundleIndices.add(bundleIndex);
    else group.forEach((groupBundleIndex) => materializedBundleIndices.add(groupBundleIndex));
  }

  const replacementsBySpan = new Map<string, { span: SourceSpan; text: string }>();
  for (const bundleIndex of [...materializedBundleIndices].sort((a, b) => a - b)) {
    const astBundle = kernelBundles.find((bundle) => bundle.index === bundleIndex);
    if (!astBundle) {
      return {
        status: 'conflict',
        diagnostics: [diagnostic(primaryBundle.span, `Bundle ${bundleIndex} is not patchable.`)]
      };
    }

    const entries = sourceMap.entries.filter((entry) => entry.bundle === bundleIndex);
    if (entries.length > 0 && !canPatchEntries(entries)) {
      const currentMatrix = matrixFromProgram(program, bundleIndex, astBundle.label);
      const previewReplacement = currentMatrix
        ? indentReplacement(
          canonicalizeBundleMatrix(mutateMatrix(currentMatrix, normalizedPatch), { statementIndent: '    ' }),
          leadingIndentForSpan(source, astBundle.span)
        )
        : '';
      const previewSource = currentMatrix
        ? replaceSpanByWholeLines(source, astBundle.span, previewReplacement)
        : source;
      return {
        status: 'materializationRequired',
        previewSource,
        previewDiff: diffPreview(source, previewSource),
        diagnostics: [diagnostic(astBundle.span, `Bundle ${bundleIndex} requires explicit materialization before applying the visual edit.`)],
        changedLineRanges: currentMatrix
          ? changedLineRangesForReplacements([{ span: astBundle.span, text: previewReplacement }])
          : []
      };
    }

    const matrix = matrixFromProgram(program, bundleIndex, astBundle.label);
    if (!matrix) {
      return {
        status: 'conflict',
        diagnostics: [diagnostic(astBundle.span, `Bundle ${bundleIndex} has no emitted matrix.`)]
      };
    }

    const replacement = canonicalizeBundleMatrix(
      patchAffectsBundle(normalizedPatch, bundleIndex)
        ? mutateMatrix(matrix, normalizedPatch)
        : matrix,
      { statementIndent: '    ' }
    );
    const key = spanKey(astBundle.span);
    const existing = replacementsBySpan.get(key);
    replacementsBySpan.set(key, {
      span: astBundle.span,
      text: existing ? `${existing.text}\n${replacement}` : replacement
    });
  }

  const replacements = [...replacementsBySpan.values()].map((replacement) => ({
    ...replacement,
    text: indentReplacement(replacement.text, leadingIndentForSpan(source, replacement.span))
  }));
  const changedLineRanges = changedLineRangesForReplacements(replacements);
  const updatedSource = replacements
    .sort((a, b) => b.span.startLine - a.span.startLine)
    .reduce(
      (currentSource, replacement) => replaceSpanByWholeLines(currentSource, replacement.span, replacement.text),
      source
    );
  const previewDiff = diffPreview(source, updatedSource);

  if (options.previewOnly) {
    return {
      status: 'preview',
      updatedSource,
      previewDiff,
      sourceHash,
      changedLineRanges
    };
  }

  const updatedArtifacts = compileWithSourceMap(updatedSource);
  if (!updatedArtifacts.success) {
    return {
      status: 'verificationFailed',
      diagnostics: updatedArtifacts.diagnostics
    };
  }

  return {
    status: 'applied',
    updatedSource,
    updatedArtifacts,
    previewDiff,
    sourceHash: hashCastmSource(updatedSource),
    changedLineRanges
  };
}
