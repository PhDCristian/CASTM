import {
  CastmSourceMap,
  CastmSourceMapEntry,
  LirProgram,
  MirProgram,
  SourceSpan
} from '@castm/compiler-ir';
import type {
  CastmBundleMatrix,
  CastmVisualPatch
} from './visual-patch-types.js';

type SlotProgram = MirProgram | LirProgram;

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

export function matrixFromProgram(program: SlotProgram, bundleIndex: number, label?: string): CastmBundleMatrix | null {
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

export function entryAt(
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

export function normalizeMovePatchInstruction(
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

export function patchAffectsBundle(patch: CastmVisualPatch, bundleIndex: number): boolean {
  if (patch.kind === 'move-slot') {
    return patch.from.bundle === bundleIndex || patch.to.bundle === bundleIndex;
  }
  return patch.bundle === bundleIndex;
}

export function affectedBundleIndices(patch: CastmVisualPatch): number[] {
  if (patch.kind !== 'move-slot') return [patch.bundle];
  return [...new Set([patch.from.bundle, patch.to.bundle])];
}

export function mutateMatrix(matrix: CastmBundleMatrix, patch: CastmVisualPatch): CastmBundleMatrix {
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

export function patchBundleIndex(patch: CastmVisualPatch): number {
  return patch.kind === 'move-slot' ? patch.to.bundle : patch.bundle;
}

export function spanKey(span: SourceSpan): string {
  return `${span.startLine}:${span.startColumn}:${span.endLine}:${span.endColumn}`;
}

export function canPatchEntries(entries: CastmSourceMapEntry[]): boolean {
  const editable = new Set(['direct-editable', 'canonicalize-region']);
  return entries.length > 0 && entries.every((entry) => editable.has(entry.source.editPolicy));
}

export function groupBundlesByExactSpan(bundles: Array<{ index: number; span: SourceSpan }>, bundleIndex: number): number[] {
  const target = bundles.find((bundle) => bundle.index === bundleIndex);
  if (!target) return [];
  const key = spanKey(target.span);
  return bundles
    .filter((bundle) => spanKey(bundle.span) === key)
    .map((bundle) => bundle.index)
    .sort((a, b) => a - b);
}
