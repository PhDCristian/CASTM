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
        bundles: input.bundles.map((bundle) => ({
          index: bundle.index,
          slots: bundle.slots.map((slot) => ({
            row: slot.row,
            col: slot.col,
            instruction: {
              opcode: slot.instruction.opcode,
              operands: [...slot.instruction.operands],
              span: { ...slot.instruction.span }
            },
            ...(slot.source ? { source: { ...slot.source } } : {})
          }))
        }))
      },
      diagnostics
    };
  }
};
