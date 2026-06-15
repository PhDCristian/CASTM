import type {
  CastmSourceMapEntry,
  SourceSpan,
  StructuredBundleStmtAst,
  StructuredFnCallStmtAst,
  StructuredKernelStmtAst,
  StructuredProgramAst
} from '@castm/compiler-ir';
import type { CastmCompileArtifacts } from './compiler-driver/source-map-driver.js';

export type CastmSemanticSymbolKind = 'function' | 'label' | 'bundle' | 'kernel';

export interface CastmNavigationCell {
  bundle: number;
  row: number;
  col: number;
  instruction?: string;
}

export interface CastmSemanticSymbol {
  id: string;
  kind: CastmSemanticSymbolKind;
  name: string;
  definitionSpan: SourceSpan;
  referenceSpans: SourceSpan[];
  emittedCells: CastmNavigationCell[];
}

export interface CastmNavigationSourceRange {
  span: SourceSpan;
  instructionSpan?: SourceSpan;
  originKind: string;
  target: {
    cells: CastmNavigationCell[];
  };
}

export interface CastmNavigationIndex {
  version: 1;
  sourceHash?: string;
  compilerVersion?: string;
  symbols: CastmSemanticSymbol[];
  sourceRanges: CastmNavigationSourceRange[];
}

interface InstructionReference {
  text: string;
  span: SourceSpan;
}

const spanKey = (span: SourceSpan): string => [
  span.startLine,
  span.startColumn,
  span.endLine,
  span.endColumn
].join(':');

const isWordChar = (char: string | undefined): boolean => Boolean(char && /[A-Za-z0-9_]/.test(char));

function spanContains(outer: SourceSpan, inner: SourceSpan): boolean {
  if (inner.startLine < outer.startLine || inner.endLine > outer.endLine) return false;
  if (inner.startLine === outer.startLine && inner.startColumn < outer.startColumn) return false;
  if (inner.endLine === outer.endLine && inner.endColumn > outer.endColumn) return false;
  return true;
}

function cellFromEntry(entry: CastmSourceMapEntry): CastmNavigationCell {
  return {
    bundle: entry.bundle,
    row: entry.row,
    col: entry.col,
    instruction: entry.instruction
  };
}

function dedupeCells(cells: CastmNavigationCell[]): CastmNavigationCell[] {
  const seen = new Map<string, CastmNavigationCell>();
  for (const cell of cells) {
    seen.set(`${cell.bundle}:${cell.row}:${cell.col}`, cell);
  }
  return [...seen.values()].sort((a, b) => (
    a.bundle - b.bundle || a.row - b.row || a.col - b.col
  ));
}

function dedupeSpans(spans: SourceSpan[]): SourceSpan[] {
  const seen = new Map<string, SourceSpan>();
  for (const span of spans) {
    seen.set(spanKey(span), span);
  }
  return [...seen.values()].sort((a, b) => (
    a.startLine - b.startLine || a.startColumn - b.startColumn
  ));
}

function cellsForSpan(entries: CastmSourceMapEntry[], span: SourceSpan): CastmNavigationCell[] {
  return dedupeCells(entries
    .filter((entry) => (
      spanContains(span, entry.source.originSpan)
      || spanContains(span, entry.source.instructionSpan)
      || spanContains(entry.source.originSpan, span)
      || spanContains(entry.source.instructionSpan, span)
    ))
    .map(cellFromEntry));
}

function collectInstructionReferencesFromBundle(
  bundle: StructuredBundleStmtAst,
  output: InstructionReference[]
): void {
  for (const statement of bundle.bundle.statements) {
    if ('instruction' in statement) {
      output.push({
        text: statement.instruction.text,
        span: statement.instruction.span
      });
      continue;
    }

    if ('instructions' in statement) {
      for (const instruction of statement.instructions) {
        output.push({ text: instruction.text, span: instruction.span });
      }
    }
  }
}

function walkStatements(
  statements: StructuredKernelStmtAst[],
  visitors: {
    fnCall?: (statement: StructuredFnCallStmtAst) => void;
    bundle?: (statement: StructuredBundleStmtAst) => void;
    labeled?: (name: string, span: SourceSpan) => void;
  }
): void {
  for (const statement of statements) {
    if ('label' in statement && statement.label) {
      visitors.labeled?.(statement.label, statement.span);
    }

    switch (statement.kind) {
      case 'fn-call':
        visitors.fnCall?.(statement);
        break;
      case 'bundle':
        visitors.bundle?.(statement);
        if (statement.bundle.label) {
          visitors.labeled?.(statement.bundle.label, statement.bundle.span);
        }
        break;
      case 'for':
      case 'while':
        walkStatements(statement.body, visitors);
        break;
      case 'if':
        walkStatements(statement.thenBody, visitors);
        if (statement.elseBody) walkStatements(statement.elseBody, visitors);
        break;
      case 'advanced':
      case 'break':
      case 'continue':
        break;
    }
  }
}

function buildSourceRanges(entries: CastmSourceMapEntry[]): CastmNavigationSourceRange[] {
  const byOrigin = new Map<string, CastmNavigationSourceRange>();

  for (const entry of entries) {
    const key = spanKey(entry.source.originSpan);
    const existing = byOrigin.get(key);
    if (existing) {
      existing.target.cells = dedupeCells([...existing.target.cells, cellFromEntry(entry)]);
      continue;
    }

    byOrigin.set(key, {
      span: entry.source.originSpan,
      instructionSpan: entry.source.instructionSpan,
      originKind: entry.source.originKind,
      target: { cells: [cellFromEntry(entry)] }
    });
  }

  return [...byOrigin.values()].sort((a, b) => (
    a.span.startLine - b.span.startLine || a.span.startColumn - b.span.startColumn
  ));
}

function wordRegex(word: string): RegExp {
  return new RegExp(`(^|[^A-Za-z0-9_])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_]|$)`);
}

function labelDefinitionSpan(name: string, statementSpan: SourceSpan): SourceSpan {
  if (statementSpan.startLine !== statementSpan.endLine) return statementSpan;
  return {
    startLine: statementSpan.startLine,
    startColumn: statementSpan.startColumn,
    endLine: statementSpan.startLine,
    endColumn: statementSpan.startColumn + name.length
  };
}

function wordSpanInReference(reference: InstructionReference, word: string): SourceSpan | null {
  let searchFrom = 0;
  while (searchFrom < reference.text.length) {
    const index = reference.text.indexOf(word, searchFrom);
    if (index < 0) return null;

    const before = reference.text[index - 1];
    const after = reference.text[index + word.length];
    if (!isWordChar(before) && !isWordChar(after) && reference.span.startLine === reference.span.endLine) {
      return {
        startLine: reference.span.startLine,
        startColumn: reference.span.startColumn + index,
        endLine: reference.span.startLine,
        endColumn: reference.span.startColumn + index + word.length
      };
    }

    searchFrom = index + word.length;
  }
  return null;
}

function collectSymbols(
  structuredAst: StructuredProgramAst | undefined,
  entries: CastmSourceMapEntry[]
): CastmSemanticSymbol[] {
  if (!structuredAst) return [];

  const symbols = new Map<string, CastmSemanticSymbol>();
  const functionCalls: StructuredFnCallStmtAst[] = [];
  const instructionReferences: InstructionReference[] = [];

  const addSymbol = (symbol: CastmSemanticSymbol): void => {
    const existing = symbols.get(symbol.id);
    if (!existing) {
      symbols.set(symbol.id, {
        ...symbol,
        referenceSpans: dedupeSpans(symbol.referenceSpans),
        emittedCells: dedupeCells(symbol.emittedCells)
      });
      return;
    }

    existing.referenceSpans = dedupeSpans([...existing.referenceSpans, ...symbol.referenceSpans]);
    existing.emittedCells = dedupeCells([...existing.emittedCells, ...symbol.emittedCells]);
  };

  const addLabel = (name: string, span: SourceSpan): void => {
    addSymbol({
      id: `label:${name}`,
      kind: 'label',
      name,
      definitionSpan: labelDefinitionSpan(name, span),
      referenceSpans: [],
      emittedCells: cellsForSpan(entries, span)
    });
  };

  for (const fn of structuredAst.functions) {
    addSymbol({
      id: `function:${fn.name}`,
      kind: 'function',
      name: fn.name,
      definitionSpan: fn.span,
      referenceSpans: [],
      emittedCells: []
    });
    walkStatements(fn.body, {
      bundle: (statement) => collectInstructionReferencesFromBundle(statement, instructionReferences),
      fnCall: (statement) => functionCalls.push(statement),
      labeled: addLabel
    });
  }

  if (structuredAst.kernel) {
    addSymbol({
      id: `kernel:${structuredAst.kernel.name}`,
      kind: 'kernel',
      name: structuredAst.kernel.name,
      definitionSpan: structuredAst.kernel.span,
      referenceSpans: [],
      emittedCells: cellsForSpan(entries, structuredAst.kernel.span)
    });

    walkStatements(structuredAst.kernel.body, {
      fnCall: (statement) => functionCalls.push(statement),
      bundle: (statement) => {
        const bundleName = statement.bundle.label ?? `bundle:${statement.bundle.index}`;
        addSymbol({
          id: `bundle:${statement.bundle.index}:${bundleName}`,
          kind: 'bundle',
          name: bundleName,
          definitionSpan: statement.bundle.span,
          referenceSpans: [],
          emittedCells: cellsForSpan(entries, statement.bundle.span)
        });
        collectInstructionReferencesFromBundle(statement, instructionReferences);
      },
      labeled: addLabel
    });
  }

  for (const call of functionCalls) {
    const id = `function:${call.name}`;
    const existing = symbols.get(id);
    if (!existing) continue;
    existing.referenceSpans = dedupeSpans([...existing.referenceSpans, call.span]);
    existing.emittedCells = dedupeCells([...existing.emittedCells, ...cellsForSpan(entries, call.span)]);
  }

  const labelSymbols = [...symbols.values()].filter((symbol) => symbol.kind === 'label');
  for (const label of labelSymbols) {
    const re = wordRegex(label.name);
    const references = instructionReferences
      .filter((reference) => re.test(reference.text))
      .map((reference) => wordSpanInReference(reference, label.name) ?? reference.span)
      .filter((span) => spanKey(span) !== spanKey(label.definitionSpan));
    label.referenceSpans = dedupeSpans([...label.referenceSpans, ...references]);
  }

  return [...symbols.values()].sort((a, b) => (
    a.definitionSpan.startLine - b.definitionSpan.startLine
    || a.definitionSpan.startColumn - b.definitionSpan.startColumn
    || a.kind.localeCompare(b.kind)
    || a.name.localeCompare(b.name)
  ));
}

export function buildNavigationIndex(artifacts: CastmCompileArtifacts): CastmNavigationIndex {
  const entries = artifacts.emitResult?.sourceMap?.entries ?? [];
  const structuredAst = artifacts.analysisResult?.structuredAst ?? artifacts.parseResult.structuredAst;

  return {
    version: 1,
    sourceHash: artifacts.sourceHash,
    compilerVersion: artifacts.compilerVersion,
    symbols: collectSymbols(structuredAst, entries),
    sourceRanges: buildSourceRanges(entries)
  };
}
