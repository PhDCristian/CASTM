import {
  CastmSourceMap,
  CastmSourceMapEntry,
  SourceSpan
} from '@castm/compiler-ir';
import { entryAt } from './visual-patch-matrix.js';
import type {
  CastmLineRange,
  CastmVisualPatch
} from './visual-patch-types.js';

export type Replacement = { span: SourceSpan; text: string };

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

export function replaceSpanByWholeLines(source: string, span: SourceSpan, replacement: string): string {
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

export function applyLineEdits(source: string, edits: LineEdit[]): string {
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

export function tryBuildDirectMoveEdits(
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

export function leadingIndentForSpan(source: string, span: SourceSpan): string {
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

export function indentReplacement(replacement: string, indent: string): string {
  if (!indent) return replacement;
  return replacement
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n');
}

function countLines(text: string): number {
  return text.split(/\r?\n/).length;
}

export function changedLineRangesForReplacements(replacements: Replacement[]): CastmLineRange[] {
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

export function diffPreview(before: string, after: string): string {
  if (before === after) return 'No source changes.';
  return [
    '--- before',
    '+++ after',
    before,
    after
  ].join('\n');
}
