import {
  AstProgram,
  CompilerPass
} from '@openedge/compiler-ir';
import { transformInstructions } from '../desugar-utils.js';

/**
 * Desugar pass for JUMP-related sugar:
 *
 * 1. `goto X`   → `JUMP X, ZERO`   (goto sugar — parser yields opcode 'GOTO')
 * 2. `JUMP X`   → `JUMP X, ZERO`   (implicit ZERO when 2nd operand omitted)
 * 3. `JUMP X, Y` is left untouched  (explicit condition preserved)
 */
export const desugarGotoPass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-goto',
  run(input) {
    const { output, diagnostics } = transformInstructions(input, (instruction) => {
      const opcode = instruction.opcode?.toUpperCase();

      // ── goto sugar: parsed as opcode 'GOTO' with 1 operand ──
      if (opcode === 'GOTO' && instruction.operands.length >= 1) {
        const target = instruction.operands[0];
        return {
          ...instruction,
          opcode: 'JUMP',
          operands: [target, 'ZERO'],
          text: `JUMP ${target}, ZERO`
        };
      }

      // ── implicit ZERO: "JUMP X" (1 operand) → "JUMP X, ZERO" ──
      if (opcode === 'JUMP' && instruction.operands.length === 1) {
        const target = instruction.operands[0];
        return {
          ...instruction,
          operands: [target, 'ZERO'],
          text: `JUMP ${target}, ZERO`
        };
      }

      return instruction;
    });

    return { output, diagnostics };
  }
};
