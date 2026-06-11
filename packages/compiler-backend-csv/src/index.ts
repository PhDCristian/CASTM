import {
  CastmSlotSource,
  CastmSourceMap,
  Diagnostic,
  EmitOptions,
  EmitResult,
  LirProgram,
  MirProgram
} from '@castm/compiler-ir';

type CsvProgram = MirProgram | LirProgram;

function sortSlotsByPosition(program: CsvProgram): CsvProgram {
  return {
    ...program,
    bundles: program.bundles.map((bundle) => ({
      ...bundle,
      slots: [...bundle.slots].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      })
    }))
  };
}

function quoteCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatMatrixCell(value: string): string {
  return /[",\n]/.test(value) ? quoteCell(value) : value;
}

function formatInstruction(opcode: string, operands: string[]): string {
  if (!operands.length) return opcode;
  return `${opcode} ${operands.join(', ')}`;
}

function fallbackSource(bundleIndex: number, row: number, col: number, slot: CsvProgram['bundles'][number]['slots'][number]): CastmSlotSource {
  const stableBundleId = `bundle:${bundleIndex}`;
  const stableSlotId = `${stableBundleId}:@${row},${col}`;
  return {
    stableBundleId,
    stableSlotId,
    originKind: 'synthetic',
    editPolicy: 'materialization-required',
    originSpan: { ...slot.instruction.span },
    instructionSpan: { ...slot.instruction.span },
    humanAuthored: false
  };
}

function buildSourceMap(program: CsvProgram, format: NonNullable<EmitOptions['format']>, includeHeader: boolean): CastmSourceMap {
  const entries: CastmSourceMap['entries'] = [];
  const bundles = [...program.bundles].sort((a, b) => a.index - b.index);
  let line = includeHeader && format === 'flat-csv' ? 2 : 1;

  for (const bundle of bundles) {
    if (format === 'sim-matrix-csv') {
      const bundleHeaderLine = line;
      line += 1 + program.grid.rows;
      for (const slot of bundle.slots) {
        const instruction = formatInstruction(slot.instruction.opcode, slot.instruction.operands);
        const source = slot.source ?? fallbackSource(bundle.index, slot.row, slot.col, slot);
        entries.push({
          stableBundleId: source.stableBundleId,
          stableSlotId: source.stableSlotId,
          bundle: bundle.index,
          row: slot.row,
          col: slot.col,
          instruction,
          source,
          emit: {
            format,
            line: bundleHeaderLine + 1 + slot.row,
            column: slot.col + 1
          }
        });
      }
      continue;
    }

    for (const slot of bundle.slots) {
      const instruction = formatInstruction(slot.instruction.opcode, slot.instruction.operands);
      const source = slot.source ?? fallbackSource(bundle.index, slot.row, slot.col, slot);
      entries.push({
        stableBundleId: source.stableBundleId,
        stableSlotId: source.stableSlotId,
        bundle: bundle.index,
        row: slot.row,
        col: slot.col,
        instruction,
        source,
        emit: {
          format,
          line,
          column: 1
        }
      });
      line++;
    }
  }

  return {
    version: 1,
    targetProfileId: program.targetProfileId,
    grid: { ...program.grid },
    entries
  };
}

function emitFlatCsv(program: CsvProgram, includeHeader: boolean): string {
  const lines: string[] = [];
  if (includeHeader) {
    lines.push('bundle,row,col,instruction');
  }

  const bundles = [...program.bundles].sort((a, b) => a.index - b.index);
  for (const bundle of bundles) {
    for (const slot of bundle.slots) {
      const instruction = [slot.instruction.opcode, ...slot.instruction.operands].join(' ').trim();
      lines.push(`${bundle.index},${slot.row},${slot.col},${instruction}`);
    }
  }

  return lines.join('\n');
}

function emitSimMatrixCsv(program: CsvProgram): string {
  const lines: string[] = [];
  const rows = program.grid.rows;
  const cols = program.grid.cols;

  const bundles = [...program.bundles].sort((a, b) => a.index - b.index);
  for (const bundle of bundles) {
    lines.push(String(bundle.index));

    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'NOP'));
    for (const slot of bundle.slots) {
      if (slot.row < 0 || slot.row >= rows || slot.col < 0 || slot.col >= cols) continue;
      grid[slot.row][slot.col] = formatInstruction(
        slot.instruction.opcode,
        slot.instruction.operands
      );
    }

    for (let row = 0; row < rows; row++) {
      lines.push(grid[row].map(formatMatrixCell).join(','));
    }
  }

  return lines.join('\n');
}

export function emitCsv(program: CsvProgram, options: EmitOptions = {}): EmitResult {
  const diagnostics: Diagnostic[] = [];
  const normalized = sortSlotsByPosition(program);
  const includeHeader = options.includeBundleHeader !== false;
  const format = options.format ?? 'flat-csv';

  const csv = format === 'sim-matrix-csv'
    ? emitSimMatrixCsv(normalized)
    : emitFlatCsv(normalized, includeHeader);
  const sourceMap = buildSourceMap(normalized, format, includeHeader);

  return {
    success: diagnostics.every((d) => d.severity !== 'error'),
    diagnostics,
    csv,
    sourceMap
  };
}
