import { describe, expect, it } from 'vitest';
import { spanAt } from '@castm/compiler-ir';
import { desugarInlineArithmeticPass } from '../packages/compiler-api/src/passes-shared/desugar/inline-arithmetic-pass.js';
import { specializePass } from '../packages/compiler-api/src/passes-shared/desugar/specialize-pass.js';

const span = spanAt(1, 1, 1);

function makeAstFromInstructions(instructions: Array<{ text: string; opcode: string; operands: string[] }>) {
  return {
    targetProfileId: 'uma-cgra-base',
    span,
    kernel: {
      name: 'k',
      config: undefined,
      directives: [],
      pragmas: [],
      cycles: [
        {
          index: 0,
          statements: instructions.map((inst, idx) => ({
            kind: 'at' as const,
            row: 0,
            col: idx,
            instruction: {
              text: inst.text,
              opcode: inst.opcode,
              operands: [...inst.operands],
              span
            },
            span
          })),
          span
        }
      ],
      span
    }
  };
}

describe('compiler-api desugar pass units', () => {
  it('inline arithmetic pass handles IMM folding and malformed IMM fallback', () => {
    const input = makeAstFromInstructions([
      { text: 'SADD R1, ZERO, IMM(2 + 3)', opcode: 'SADD', operands: ['R1', 'ZERO', 'IMM(2 + 3)'] },
      { text: 'SADD R2, ZERO, IMM(1 +)', opcode: 'SADD', operands: ['R2', 'ZERO', 'IMM(1 +)'] },
      { text: 'SADD R3, ZERO, 2 + 4', opcode: 'SADD', operands: ['R3', 'ZERO', '2 + 4'] }
    ]);

    const result = desugarInlineArithmeticPass.run(input as any);
    const statements = result.output.kernel!.cycles[0].statements as any[];

    expect(statements[0].instruction.operands[2]).toBe('5');
    expect(statements[1].instruction.operands[2]).toBe('1 +');
    expect(statements[2].instruction.operands[2]).toBe('6');
  });

  it('specialize pass parses IMM operands and applies identity rewrites', () => {
    const input = makeAstFromInstructions([
      { text: 'SADD R1, R0, IMM(0)', opcode: 'SADD', operands: ['R1', 'R0', 'IMM(0)'] },
      { text: 'SMUL R2, R0, IMM(1)', opcode: 'SMUL', operands: ['R2', 'R0', 'IMM(1)'] },
      { text: 'LAND R3, IMM(0), R4', opcode: 'LAND', operands: ['R3', 'IMM(0)', 'R4'] }
    ]);

    const result = specializePass.run(input as any);
    const statements = result.output.kernel!.cycles[0].statements as any[];

    expect(statements[0].instruction.text).toBe('SADD R1, R0, ZERO');
    expect(statements[1].instruction.text).toBe('SADD R2, R0, ZERO');
    expect(statements[2].instruction.text).toBe('SADD R3, ZERO, ZERO');
  });
});
