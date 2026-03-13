import { describe, expect, it } from 'vitest';
import { ErrorCodes, spanAt } from '@castm/compiler-ir';
import {
  isArrayAddress,
  isMemoryReference,
  isRawAddress,
  toAddressOperand
} from '../packages/compiler-api/src/passes-shared/desugar-utils/memory.js';
import {
  requireIdentifier,
  transformInstructions
} from '../packages/compiler-api/src/passes-shared/desugar-utils/transform.js';

const span = spanAt(1, 1, 1);

function makeAst() {
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
          statements: [
            {
              kind: 'at' as const,
              row: 0,
              col: 0,
              instruction: {
                text: 'SADD R1, R2, R3',
                opcode: 'SADD',
                operands: ['R1', 'R2', 'R3'],
                span
              },
              span
            },
            {
              kind: 'row' as const,
              row: 1,
              instructions: [
                {
                  text: 'NOP',
                  opcode: 'NOP',
                  operands: [],
                  span
                }
              ],
              span
            }
          ],
          span
        }
      ],
      span
    }
  };
}

describe('compiler-api desugar utils', () => {
  it('recognizes memory reference forms', () => {
    expect(isRawAddress('[360 + i*4]')).toBe(true);
    expect(isRawAddress('A[i]')).toBe(false);

    expect(isArrayAddress('A[i]')).toBe(true);
    expect(isArrayAddress('M[i][j]')).toBe(true);
    expect(isArrayAddress(' [bad] ')).toBe(false);

    expect(isMemoryReference('[8]')).toBe(true);
    expect(isMemoryReference('A[i]')).toBe(true);
    expect(isMemoryReference('R1')).toBe(false);
  });

  it('converts raw, 1D and 2D addresses including diagnostics on invalid forms', () => {
    const symbols = new Map<string, any>([
      ['A', { start: 100, length: 4 }],
      ['M', { start: 200, length: 9, rows: 3, cols: 3 }]
    ]);
    const diagnostics: any[] = [];

    expect(toAddressOperand('[360 + i*4]', symbols, diagnostics, span)).toBe('360 + i*4');
    expect(toAddressOperand('plain_token', symbols, diagnostics, span)).toBe('plain_token');

    expect(toAddressOperand('A[2]', symbols, diagnostics, span)).toBe('108');
    expect(toAddressOperand('A[i + 1]', symbols, diagnostics, span)).toBe('100 + (i+1) * 4');

    expect(toAddressOperand('M[1][2]', symbols, diagnostics, span)).toBe('220');
    expect(toAddressOperand('M[r][c]', symbols, diagnostics, span)).toBe('200 + (((r) * 3) + (c)) * 4');

    expect(toAddressOperand('UNKNOWN[0]', symbols, diagnostics, span)).toBeNull();
    expect(toAddressOperand('A[1][2]', symbols, diagnostics, span)).toBeNull();
    expect(toAddressOperand('M[1]', symbols, diagnostics, span)).toBeNull();
    expect(toAddressOperand('A[-1]', symbols, diagnostics, span)).toBeNull();
    expect(toAddressOperand('M[9][9]', symbols, diagnostics, span)).toBeNull();

    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain(ErrorCodes.Semantic.InvalidAssignment);
    expect(codes).toContain(ErrorCodes.Semantic.UnsupportedOperation);
    expect(codes).toContain(ErrorCodes.Semantic.CoordinateOutOfBounds);
  });

  it('transforms instructions immutably and validates identifier requirements', () => {
    const input = makeAst();
    const { output, diagnostics } = transformInstructions(input as any, (instruction) => ({
      ...instruction,
      text: `${instruction.text} ; transformed`
    }));

    expect(diagnostics).toHaveLength(0);
    expect(output.kernel?.cycles[0].statements[0]).toMatchObject({
      kind: 'at'
    });
    expect((output.kernel!.cycles[0].statements[0] as any).instruction.text).toContain('transformed');
    expect((input.kernel!.cycles[0].statements[0] as any).instruction.text).toBe('SADD R1, R2, R3');

    const noKernel = transformInstructions(
      { ...input, kernel: null } as any,
      (instruction) => instruction
    );
    expect(noKernel.output.kernel).toBeNull();
    expect(noKernel.diagnostics).toEqual([]);

    const requireDiagnostics: any[] = [];
    expect(requireIdentifier('R1', requireDiagnostics, span, 'bad', 'hint')).toBe(true);
    expect(requireIdentifier('1R', requireDiagnostics, span, 'bad', 'hint')).toBe(false);
    expect(requireDiagnostics).toHaveLength(1);
    expect(requireDiagnostics[0].code).toBe(ErrorCodes.Semantic.InvalidAssignment);
  });
});
