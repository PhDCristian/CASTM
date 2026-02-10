import { Diagnostic, EmitOptions, EmitResult, MirProgram } from '@openedge/compiler-ir';

function sortSlotsByPosition(program: MirProgram): MirProgram {
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

export function emitCsv(program: MirProgram, options: EmitOptions = {}): EmitResult {
  const diagnostics: Diagnostic[] = [];
  const normalized = sortSlotsByPosition(program);
  const includeHeader = options.includeCycleHeader !== false;

  const lines: string[] = [];
  if (includeHeader) {
    lines.push('cycle,row,col,instruction');
  }

  for (const cycle of normalized.cycles) {
    for (const slot of cycle.slots) {
      const instruction = [slot.instruction.opcode, ...slot.instruction.operands].join(' ').trim();
      lines.push(`${cycle.index},${slot.row},${slot.col},${instruction}`);
    }
  }

  return {
    success: diagnostics.every((d) => d.severity !== 'error'),
    diagnostics,
    csv: lines.join('\n')
  };
}
