import {
  CompilerPass,
  Diagnostic,
  LirProgram,
  MirProgram
} from '@castm/compiler-ir';

export const lowerToLirPass: CompilerPass<MirProgram, LirProgram> = {
  name: 'lower-to-lir',
  run(input) {
    const diagnostics: Diagnostic[] = [];

    return {
      output: {
        targetProfileId: input.targetProfileId,
        grid: { ...input.grid },
        cycles: input.cycles.map((cycle) => ({
          index: cycle.index,
          slots: cycle.slots.map((slot) => ({
            row: slot.row,
            col: slot.col,
            instruction: {
              opcode: slot.instruction.opcode,
              operands: [...slot.instruction.operands],
              span: { ...slot.instruction.span }
            }
          }))
        }))
      },
      diagnostics
    };
  }
};
