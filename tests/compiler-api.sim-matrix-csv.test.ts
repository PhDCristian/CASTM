import { describe, expect, it } from 'vitest';
import { emit, MirProgram } from '@castm/compiler-api';

describe('compiler-api sim-matrix-csv emitter', () => {
  it('emits simulator-style matrix blocks with NOP-filled gaps', () => {
    const mir: MirProgram = {
      targetProfileId: 'uma-cgra-base',
      grid: { rows: 4, cols: 4, topology: 'torus' },
      cycles: [
        {
          index: 0,
          slots: [
            {
              row: 0,
              col: 0,
              instruction: {
                opcode: 'LWD',
                operands: ['R0'],
                text: 'LWD R0'
              }
            },
            {
              row: 3,
              col: 3,
              instruction: {
                opcode: 'SADD',
                operands: ['R1', 'R0', '1'],
                text: 'SADD R1 R0 1'
              }
            }
          ]
        }
      ]
    };

    const result = emit(mir, { format: 'sim-matrix-csv', includeCycleHeader: true });
    expect(result.success).toBe(true);

    const lines = (result.csv ?? '').split('\n');
    expect(lines[0]).toBe('0');
    expect(lines[1]).toBe('LWD R0,NOP,NOP,NOP');
    expect(lines[2]).toBe('NOP,NOP,NOP,NOP');
    expect(lines[3]).toBe('NOP,NOP,NOP,NOP');
    expect(lines[4]).toBe('NOP,NOP,NOP,"SADD R1, R0, 1"');
    expect(result.csv).not.toContain('...');
  });
});
