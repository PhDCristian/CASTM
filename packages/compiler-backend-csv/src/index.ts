import { Diagnostic, EmitOptions, EmitResult, LirProgram, MirProgram } from '@castm/compiler-ir';

type CsvProgram = MirProgram | LirProgram;

function sortSlotsByPosition(program: CsvProgram): CsvProgram {
  return {
    ...program,
    cycles: program.cycles.map((cycle) => ({
      ...cycle,
      slots: [...cycle.slots].sort((a, b) => {
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

function emitFlatCsv(program: CsvProgram, includeHeader: boolean): string {
  const lines: string[] = [];
  if (includeHeader) {
    lines.push('cycle,row,col,instruction');
  }

  const cycles = [...program.cycles].sort((a, b) => a.index - b.index);
  for (const cycle of cycles) {
    for (const slot of cycle.slots) {
      const instruction = [slot.instruction.opcode, ...slot.instruction.operands].join(' ').trim();
      lines.push(`${cycle.index},${slot.row},${slot.col},${instruction}`);
    }
  }

  return lines.join('\n');
}

function emitSimMatrixCsv(program: CsvProgram): string {
  const lines: string[] = [];
  const rows = program.grid.rows;
  const cols = program.grid.cols;

  const cycles = [...program.cycles].sort((a, b) => a.index - b.index);
  for (const cycle of cycles) {
    lines.push(String(cycle.index));

    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'NOP'));
    for (const slot of cycle.slots) {
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
  const includeHeader = options.includeCycleHeader !== false;
  const format = options.format ?? 'flat-csv';

  const csv = format === 'sim-matrix-csv'
    ? emitSimMatrixCsv(normalized)
    : emitFlatCsv(normalized, includeHeader);

  return {
    success: diagnostics.every((d) => d.severity !== 'error'),
    diagnostics,
    csv
  };
}
