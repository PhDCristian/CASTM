import {
  CompilerPass,
  Diagnostic,
  HirProgram,
  MirProgram
} from '@castm/compiler-ir';

export const lowerToMirPass: CompilerPass<HirProgram, MirProgram> = {
  name: 'lower-to-mir',
  run(input) {
    const diagnostics: Diagnostic[] = [];

    const output: MirProgram = {
      targetProfileId: input.targetProfileId,
      grid: input.grid,
      cycles: input.cycles.map((cycle) => ({
        index: cycle.index,
        slots: [...cycle.operations]
          .sort((a, b) => (a.row - b.row) || (a.col - b.col))
          .map((op) => ({
            row: op.row,
            col: op.col,
            instruction: {
              opcode: op.opcode,
              operands: [...op.operands],
              span: { ...op.span }
            }
          }))
      }))
    };

    return { output, diagnostics };
  }
};
