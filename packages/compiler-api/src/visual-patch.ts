import {
  CastmSourceMapEntry,
  CastmSourceMap,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  LirProgram,
  MirProgram,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  CastmCompileArtifacts,
  compileWithSourceMap,
  hashCastmSource
} from './compiler-driver/source-map-driver.js';

export interface CastmMatrixCell {
  row: number;
  col: number;
  instruction: string;
}

export interface CastmBundleMatrix {
  bundle: number;
  label?: string;
  grid: GridSpec;
  cells: CastmMatrixCell[];
}

export interface CastmLineRange {
  startLineNumber: number;
  endLineNumber: number;
}

export type CastmVisualPatch =
  | { kind: 'replace-slot'; bundle: number; row: number; col: number; instruction: string }
  | { kind: 'move-slot'; from: { bundle: number; row: number; col: number }; to: { bundle: number; row: number; col: number }; instruction?: string }
  | { kind: 'clear-slot'; bundle: number; row: number; col: number }
  | { kind: 'replace-region'; bundle: number; cells: CastmMatrixCell[] };

export type CastmPatchResult =
  | { status: 'applied'; updatedSource: string; updatedArtifacts: CastmCompileArtifacts; previewDiff: string; sourceHash: string; changedLineRanges: CastmLineRange[] }
  | { status: 'preview'; updatedSource: string; previewDiff: string; sourceHash: string; changedLineRanges: CastmLineRange[] }
  | { status: 'materializationRequired'; previewSource: string; previewDiff: string; diagnostics: Diagnostic[]; changedLineRanges: CastmLineRange[] }
  | { status: 'staleArtifacts'; diagnostics: Diagnostic[] }
  | { status: 'verificationFailed'; diagnostics: Diagnostic[] }
  | { status: 'conflict'; diagnostics: Diagnostic[] }
  | { status: 'invalid'; diagnostics: Diagnostic[] };

type SlotProgram = MirProgram | LirProgram;

type Replacement = { span: SourceSpan; text: string };

interface LineEdit {
  startLine: number;
  endLine: number;
  replacementLines: string[];
}

interface ParsedDirectSlotLine {
  indent: string;
  atPrefix: string;
  instruction: string;
  suffix: string;
}

function instructionText(opcode: string, operands: string[]): string {
  return operands.length ? `${opcode} ${operands.join(', ')}` : opcode;
}

function isNop(text: string | undefined): boolean {
  return !text || text.trim() === '' || text.trim().toUpperCase() === 'NOP';
}

function makeCellMap(matrix: CastmBundleMatrix): Map<string, string> {
  const map = new Map<string, string>();
  for (const cell of matrix.cells) {
    if (!isNop(cell.instruction)) {
      map.set(`${cell.row}:${cell.col}`, cell.instruction.trim());
    }
  }
  return map;
}

function cellAt(map: ReadonlyMap<string, string>, row: number, col: number): string | undefined {
  return map.get(`${row}:${col}`);
}

function allActiveCellsShareInstruction(matrix: CastmBundleMatrix): string | null {
  const map = makeCellMap(matrix);
  if (map.size !== matrix.grid.rows * matrix.grid.cols) return null;
  const values = new Set(map.values());
  return values.size === 1 ? [...values][0] : null;
}

interface CanonicalizeOptions {
  statementIndent?: string;
}

export function canonicalizeBundleMatrix(
  matrix: CastmBundleMatrix,
  options: CanonicalizeOptions = {}
): string {
  const statementIndent = options.statementIndent ?? '  ';
  const prefix = matrix.label ? `${matrix.label}: ` : '';
  const lines = [`${prefix}bundle {`];
  const allInstruction = allActiveCellsShareInstruction(matrix);
  if (allInstruction) {
    lines.push(`${statementIndent}at all: ${allInstruction};`);
    lines.push('}');
    return lines.join('\n');
  }

  const map = makeCellMap(matrix);
  const used = new Set<string>();
  const mark = (row: number, col: number) => used.add(`${row}:${col}`);
  const markRow = (row: number, startCol: number, endCol: number) => {
    for (let col = startCol; col <= endCol; col++) mark(row, col);
  };
  const markCol = (startRow: number, endRow: number, col: number) => {
    for (let row = startRow; row <= endRow; row++) mark(row, col);
  };

  for (let row = 0; row < matrix.grid.rows; row++) {
    const first = cellAt(map, row, 0);
    if (isNop(first)) continue;
    let full = true;
    for (let col = 1; col < matrix.grid.cols; col++) {
      if (cellAt(map, row, col) !== first) {
        full = false;
        break;
      }
    }
    if (full) {
      lines.push(`${statementIndent}at @${row},0..${matrix.grid.cols - 1}: ${first};`);
      markRow(row, 0, matrix.grid.cols - 1);
    }
  }

  for (let col = 0; col < matrix.grid.cols; col++) {
    const first = cellAt(map, 0, col);
    if (isNop(first) || used.has(`0:${col}`)) continue;
    let full = true;
    for (let row = 1; row < matrix.grid.rows; row++) {
      if (used.has(`${row}:${col}`) || cellAt(map, row, col) !== first) {
        full = false;
        break;
      }
    }
    if (full) {
      lines.push(`${statementIndent}at @0..${matrix.grid.rows - 1},${col}: ${first};`);
      markCol(0, matrix.grid.rows - 1, col);
    }
  }

  for (let row = 0; row < matrix.grid.rows; row++) {
    let col = 0;
    while (col < matrix.grid.cols) {
      const value = cellAt(map, row, col);
      if (used.has(`${row}:${col}`) || isNop(value)) {
        col++;
        continue;
      }
      let end = col;
      while (end + 1 < matrix.grid.cols && !used.has(`${row}:${end + 1}`) && cellAt(map, row, end + 1) === value) {
        end++;
      }
      if (end > col) {
        lines.push(`${statementIndent}at @${row},${col}..${end}: ${value};`);
        markRow(row, col, end);
      }
      col = end + 1;
    }
  }

  for (let col = 0; col < matrix.grid.cols; col++) {
    let row = 0;
    while (row < matrix.grid.rows) {
      const value = cellAt(map, row, col);
      if (used.has(`${row}:${col}`) || isNop(value)) {
        row++;
        continue;
      }
      let end = row;
      while (end + 1 < matrix.grid.rows && !used.has(`${end + 1}:${col}`) && cellAt(map, end + 1, col) === value) {
        end++;
      }
      if (end > row) {
        lines.push(`${statementIndent}at @${row}..${end},${col}: ${value};`);
        markCol(row, end, col);
      }
      row = end + 1;
    }
  }

  for (let row = 0; row < matrix.grid.rows; row++) {
    for (let col = 0; col < matrix.grid.cols; col++) {
      const key = `${row}:${col}`;
      const value = cellAt(map, row, col);
      if (used.has(key) || isNop(value)) continue;
      lines.push(`${statementIndent}@${row},${col}: ${value};`);
      used.add(key);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function matrixFromProgram(program: SlotProgram, bundleIndex: number, label?: string): CastmBundleMatrix | null {
  const bundle = program.bundles.find((candidate) => candidate.index === bundleIndex);
  if (!bundle) return null;
  return {
    bundle: bundle.index,
    ...(label ? { label } : {}),
    grid: { ...program.grid },
    cells: bundle.slots.map((slot) => ({
      row: slot.row,
      col: slot.col,
      instruction: instructionText(slot.instruction.opcode, slot.instruction.operands)
    }))
  };
}

function instructionFromMatrix(matrix: CastmBundleMatrix, row: number, col: number): string | undefined {
  return cellAt(makeCellMap(matrix), row, col);
}

function entryAt(
  sourceMap: CastmSourceMap,
  bundle: number,
  row: number,
  col: number
): CastmSourceMapEntry | undefined {
  return sourceMap.entries.find((entry) => (
    entry.bundle === bundle
    && entry.row === row
    && entry.col === col
  ));
}

function normalizeMovePatchInstruction(
  patch: CastmVisualPatch,
  sourceMatrix: CastmBundleMatrix | null
): CastmVisualPatch {
  if (patch.kind !== 'move-slot' || patch.instruction) return patch;
  return {
    ...patch,
    instruction: sourceMatrix
      ? instructionFromMatrix(sourceMatrix, patch.from.row, patch.from.col)
      : undefined
  };
}

function patchAffectsBundle(patch: CastmVisualPatch, bundleIndex: number): boolean {
  if (patch.kind === 'move-slot') {
    return patch.from.bundle === bundleIndex || patch.to.bundle === bundleIndex;
  }
  return patch.bundle === bundleIndex;
}

function affectedBundleIndices(patch: CastmVisualPatch): number[] {
  if (patch.kind !== 'move-slot') return [patch.bundle];
  return [...new Set([patch.from.bundle, patch.to.bundle])];
}

function mutateMatrix(matrix: CastmBundleMatrix, patch: CastmVisualPatch): CastmBundleMatrix {
  const map = makeCellMap(matrix);
  const setCell = (row: number, col: number, instruction: string) => {
    const key = `${row}:${col}`;
    if (isNop(instruction)) map.delete(key);
    else map.set(key, instruction.trim());
  };

  if (patch.kind === 'replace-slot' && patch.bundle === matrix.bundle) {
    setCell(patch.row, patch.col, patch.instruction);
  } else if (patch.kind === 'clear-slot' && patch.bundle === matrix.bundle) {
    setCell(patch.row, patch.col, 'NOP');
  } else if (patch.kind === 'move-slot') {
    const instruction = patch.instruction ?? 'NOP';
    if (patch.from.bundle === matrix.bundle) {
      setCell(patch.from.row, patch.from.col, 'NOP');
    }
    if (patch.to.bundle === matrix.bundle) {
      setCell(patch.to.row, patch.to.col, instruction);
    }
  } else if (patch.kind === 'replace-region' && patch.bundle === matrix.bundle) {
    for (const cell of patch.cells) {
      setCell(cell.row, cell.col, cell.instruction);
    }
  }

  return {
    ...matrix,
    cells: [...map.entries()].map(([key, instruction]) => {
      const [row, col] = key.split(':').map(Number);
      return { row, col, instruction };
    })
  };
}

function patchBundleIndex(patch: CastmVisualPatch): number {
  return patch.kind === 'move-slot' ? patch.to.bundle : patch.bundle;
}

function spanKey(span: SourceSpan): string {
  return `${span.startLine}:${span.startColumn}:${span.endLine}:${span.endColumn}`;
}

function diagnostic(span: SourceSpan, message: string, hint?: string): Diagnostic {
  return makeDiagnostic(ErrorCodes.Semantic.UnsupportedOperation, 'error', span, message, hint);
}

function canPatchEntries(entries: CastmSourceMapEntry[]): boolean {
  const editable = new Set(['direct-editable', 'canonicalize-region']);
  return entries.length > 0 && entries.every((entry) => editable.has(entry.source.editPolicy));
}

function groupBundlesByExactSpan(bundles: Array<{ index: number; span: SourceSpan }>, bundleIndex: number): number[] {
  const target = bundles.find((bundle) => bundle.index === bundleIndex);
  if (!target) return [];
  const key = spanKey(target.span);
  return bundles
    .filter((bundle) => spanKey(bundle.span) === key)
    .map((bundle) => bundle.index)
    .sort((a, b) => a - b);
}

function replaceSpanByWholeLines(source: string, span: SourceSpan, replacement: string): string {
  const lines = source.split(/\r?\n/);
  const start = Math.max(0, span.startLine - 1);
  const end = Math.max(start, span.endLine - 1);
  return [
    ...lines.slice(0, start),
    replacement,
    ...lines.slice(end + 1)
  ].join('\n');
}

function parseDirectSlotLine(line: string): ParsedDirectSlotLine | null {
  const match = line.match(/^(\s*)((?:at\s+)?)@\s*\d+\s*,\s*\d+\s*:\s*(.*?)(\s*;\s*(?:\/\/.*)?\s*)$/);
  if (!match) return null;
  return {
    indent: match[1] ?? '',
    atPrefix: match[2] ?? '',
    instruction: (match[3] ?? '').trim(),
    suffix: match[4] ?? ';'
  };
}

function formatDirectSlotLine(
  parsed: ParsedDirectSlotLine,
  row: number,
  col: number,
  instruction = parsed.instruction
): string {
  return `${parsed.indent}${parsed.atPrefix}@${row},${col}: ${instruction}${parsed.suffix}`;
}

function directSlotLineForEntry(sourceLines: string[], entry: CastmSourceMapEntry): {
  lineNumber: number;
  parsed: ParsedDirectSlotLine;
} | null {
  if (entry.source.originKind !== 'direct' || entry.source.editPolicy !== 'direct-editable') {
    return null;
  }
  const lineNumber = entry.source.originSpan.startLine;
  const parsed = parseDirectSlotLine(sourceLines[lineNumber - 1] ?? '');
  return parsed ? { lineNumber, parsed } : null;
}

function statementIndentForBundle(
  sourceLines: string[],
  sourceMap: CastmSourceMap,
  bundleIndex: number,
  astBundleSpan: SourceSpan
): string {
  const directEntry = sourceMap.entries
    .filter((entry) => entry.bundle === bundleIndex)
    .map((entry) => directSlotLineForEntry(sourceLines, entry))
    .find((line) => line !== null);

  if (directEntry) return directEntry.parsed.indent;

  const bundleLine = sourceLines[astBundleSpan.startLine - 1] ?? '';
  const bundleIndent = bundleLine.match(/^\s*/)?.[0] ?? '';
  return `${bundleIndent}    `;
}

function applyLineEdits(source: string, edits: LineEdit[]): string {
  const lines = source.split(/\r?\n/);
  return [...edits]
    .sort((a, b) => b.startLine - a.startLine)
    .reduce((currentLines, edit) => {
      const start = Math.max(0, edit.startLine - 1);
      const endExclusive = Math.max(start, edit.endLine);
      currentLines.splice(start, endExclusive - start, ...edit.replacementLines);
      return currentLines;
    }, lines)
    .join('\n');
}

function changedLineRangesForLineEdits(edits: LineEdit[]): CastmLineRange[] {
  let lineDelta = 0;
  return [...edits]
    .sort((a, b) => a.startLine - b.startLine)
    .map((edit) => {
      const removedLineCount = edit.endLine - edit.startLine + 1;
      const insertedLineCount = edit.replacementLines.length;
      const startLineNumber = edit.startLine + lineDelta;
      lineDelta += insertedLineCount - removedLineCount;
      return {
        startLineNumber,
        endLineNumber: Math.max(startLineNumber, startLineNumber + insertedLineCount - 1)
      };
    });
}

function mergeLineEdits(edits: LineEdit[]): LineEdit[] | null {
  const byLine = new Map<number, LineEdit>();
  for (const edit of edits) {
    if (edit.startLine !== edit.endLine) return null;
    if (byLine.has(edit.startLine)) return null;
    byLine.set(edit.startLine, edit);
  }
  return [...byLine.values()];
}

function tryBuildDirectMoveEdits(
  source: string,
  patch: Extract<CastmVisualPatch, { kind: 'move-slot' }>,
  sourceMap: CastmSourceMap,
  kernelBundles: Array<{ index: number; span: SourceSpan }>
): { edits: LineEdit[]; changedLineRanges: CastmLineRange[] } | null {
  const sourceLines = source.split(/\r?\n/);
  const fromEntry = entryAt(sourceMap, patch.from.bundle, patch.from.row, patch.from.col);
  if (!fromEntry) return null;

  const fromLine = directSlotLineForEntry(sourceLines, fromEntry);
  if (!fromLine) return null;

  const instruction = fromLine.parsed.instruction;
  if (!instruction) return null;

  const toEntry = entryAt(sourceMap, patch.to.bundle, patch.to.row, patch.to.col);
  const edits: LineEdit[] = [];

  if (patch.from.bundle === patch.to.bundle) {
    if (toEntry && toEntry.source.originSpan.startLine !== fromLine.lineNumber) {
      const toLine = directSlotLineForEntry(sourceLines, toEntry);
      if (!toLine) return null;
      edits.push({
        startLine: fromLine.lineNumber,
        endLine: fromLine.lineNumber,
        replacementLines: []
      });
      edits.push({
        startLine: toLine.lineNumber,
        endLine: toLine.lineNumber,
        replacementLines: [formatDirectSlotLine(toLine.parsed, patch.to.row, patch.to.col, instruction)]
      });
    } else {
      edits.push({
        startLine: fromLine.lineNumber,
        endLine: fromLine.lineNumber,
        replacementLines: [formatDirectSlotLine(fromLine.parsed, patch.to.row, patch.to.col, instruction)]
      });
    }

    const merged = mergeLineEdits(edits);
    return merged ? { edits: merged, changedLineRanges: changedLineRangesForLineEdits(merged) } : null;
  }

  edits.push({
    startLine: fromLine.lineNumber,
    endLine: fromLine.lineNumber,
    replacementLines: []
  });

  if (toEntry) {
    const toLine = directSlotLineForEntry(sourceLines, toEntry);
    if (!toLine) return null;
    edits.push({
      startLine: toLine.lineNumber,
      endLine: toLine.lineNumber,
      replacementLines: [formatDirectSlotLine(toLine.parsed, patch.to.row, patch.to.col, instruction)]
    });
  } else {
    const targetBundle = kernelBundles.find((bundle) => bundle.index === patch.to.bundle);
    if (!targetBundle) return null;
    const closingLine = sourceLines[targetBundle.span.endLine - 1] ?? '';
    if (closingLine.trim() !== '}') return null;
    const indent = statementIndentForBundle(sourceLines, sourceMap, patch.to.bundle, targetBundle.span);
    edits.push({
      startLine: targetBundle.span.endLine,
      endLine: targetBundle.span.endLine - 1,
      replacementLines: [`${indent}@${patch.to.row},${patch.to.col}: ${instruction};`]
    });
  }

  return { edits, changedLineRanges: changedLineRangesForLineEdits(edits) };
}

function leadingIndentForSpan(source: string, span: SourceSpan): string {
  const lines = source.split(/\r?\n/);
  const line = lines[span.startLine - 1] ?? '';
  const directIndent = line.match(/^\s*/)?.[0] ?? '';
  if (directIndent.length > 0) return directIndent;

  for (let i = span.startLine - 2; i >= 0; i--) {
    const previous = lines[i] ?? '';
    const trimmed = previous.trim();
    if (!trimmed) continue;

    const previousIndent = previous.match(/^\s*/)?.[0] ?? '';
    if (/^kernel\b.*\{\s*$/i.test(trimmed)) {
      return `${previousIndent}    `;
    }
    if (previousIndent.length > 0) {
      return previousIndent;
    }
  }

  return '';
}

function indentReplacement(replacement: string, indent: string): string {
  if (!indent) return replacement;
  return replacement
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n');
}

function countLines(text: string): number {
  return text.split(/\r?\n/).length;
}

function changedLineRangesForReplacements(replacements: Replacement[]): CastmLineRange[] {
  let lineDelta = 0;
  return [...replacements]
    .sort((a, b) => a.span.startLine - b.span.startLine)
    .map((replacement) => {
      const removedLineCount = replacement.span.endLine - replacement.span.startLine + 1;
      const insertedLineCount = countLines(replacement.text);
      const startLineNumber = replacement.span.startLine + lineDelta;
      lineDelta += insertedLineCount - removedLineCount;
      return {
        startLineNumber,
        endLineNumber: startLineNumber + insertedLineCount - 1
      };
    });
}

function diffPreview(before: string, after: string): string {
  if (before === after) return 'No source changes.';
  return [
    '--- before',
    '+++ after',
    before,
    after
  ].join('\n');
}

export interface ApplyVisualPatchOptions {
  expectedSourceHash?: string;
  previewOnly?: boolean;
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
