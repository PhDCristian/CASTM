import {
  AstProgram,
  CompilerPass
} from '@castm/compiler-ir';
import { transformInstructions } from '../desugar-utils.js';

/**
 * Desugar pass for JUMP-related sugar:
 *
 * 1. `goto X`   → `JUMP ZERO, X`   (goto sugar — parser yields opcode 'GOTO')
 * 2. `JUMP X`   → `JUMP ZERO, X`   (implicit ZERO predicate when omitted)
 * 3. `JUMP P, X` is left untouched  (explicit predicate + target preserved)
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
          operands: ['ZERO', target],
          text: `JUMP ZERO, ${target}`
        };
      }

      // ── implicit ZERO: "JUMP X" (1 operand) → "JUMP ZERO, X" ──
      if (opcode === 'JUMP' && instruction.operands.length === 1) {
        const target = instruction.operands[0];
        return {
          ...instruction,
          operands: ['ZERO', target],
          text: `JUMP ZERO, ${target}`
        };
      }

      return instruction;
    });

    return { output, diagnostics };
  }
};
