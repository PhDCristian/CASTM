import { describe, expect, it } from 'vitest';
import { spanAt } from '@castm/compiler-ir';
import { createSlotPackPass } from '../packages/compiler-api/src/passes-shared/desugar/slot-pack-pass.js';

const span = spanAt(1, 1, 1);
const grid: any = {
  rows: 4,
  cols: 4,
  topology: 'torus',
  wrapPolicy: 'wrap'
};

function instruction(opcode: string, operands: string[]): any {
  return {
    opcode,
    text: `${opcode} ${operands.join(', ')}`.trim(),
    operands,
    span
  };
}

function at(row: number, col: number, opcode: string, operands: string[]): any {
  return {
    kind: 'at',
    row,
    col,
    instruction: instruction(opcode, operands),
    span
  };
}

function cycle(index: number, statements: any[], label?: string): any {
  return {
    index,
    label,
    statements,
    span
  };
}

function program(cycles: any[]): any {
  return {
    targetProfileId: 'uma-cgra-base',
    kernel: {
      name: 'slot_pack_test',
      directives: [],
      pragmas: [],
      cycles,
      span
    },
    span
  };
}

describe('compiler-api slot-pack pass', () => {
  it('packs independent ALU placements into earlier cycles', () => {
    const input = program([
      cycle(0, [at(0, 0, 'SADD', ['R1', 'R0', 'ZERO'])]),
      cycle(1, [at(0, 1, 'SADD', ['R2', 'R3', 'ZERO'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 1,
      memoryReorderPolicy: 'strict'
    });
    const first = pass.run(input, { diagnostics: [] }).output;
    const second = pass.run(input, { diagnostics: [] }).output;

    expect(first.kernel.cycles).toHaveLength(1);
    expect(first.kernel.cycles[0].statements).toHaveLength(2);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('keeps memory ops pinned in strict policy but still packs independent ALU placements', () => {
    const input = program([
      cycle(0, [at(0, 0, 'LWI', ['R0', '4'])]),
      cycle(1, [at(0, 1, 'SADD', ['R2', 'R3', 'ZERO'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 2,
      memoryReorderPolicy: 'strict'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(1);
    expect(output.kernel.cycles[0].statements).toHaveLength(2);
    const opcodes = output.kernel.cycles[0].statements.map((stmt: any) => stmt.instruction.opcode);
    expect(opcodes).toContain('LWI');
    expect(opcodes).toContain('SADD');
  });

  it('keeps memory ops fixed under same-address-fence policy', () => {
    const input = program([
      cycle(0, [at(0, 0, 'LWI', ['R0', '4'])]),
      cycle(1, [at(0, 1, 'LWI', ['R1', '8'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 1,
      memoryReorderPolicy: 'same-address-fence'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(2);
    expect(output.kernel.cycles[0].statements).toHaveLength(1);
    expect(output.kernel.cycles[1].statements).toHaveLength(1);
  });

  it('keeps same-address memory operations ordered under same-address-fence policy', () => {
    const input = program([
      cycle(0, [at(0, 0, 'LWI', ['R0', '4'])]),
      cycle(1, [at(0, 1, 'SWI', ['R1', '4'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 1,
      memoryReorderPolicy: 'same-address-fence'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(2);
  });

  it('does not move memory ops with unresolved addresses under same-address-fence policy', () => {
    const input = program([
      cycle(0, [at(0, 0, 'LWI', ['R0', 'A[i]'])]),
      cycle(1, [at(0, 1, 'LWI', ['R1', 'B[j]'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 1,
      memoryReorderPolicy: 'same-address-fence'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(2);
  });

  it('keeps route-sensitive placements pinned while allowing independent ALU packing', () => {
    const input = program([
      cycle(0, [at(0, 0, 'SADD', ['ROUT', 'R1', 'ZERO'])]),
      cycle(1, [at(0, 1, 'SADD', ['R2', 'R3', 'ZERO'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 2,
      memoryReorderPolicy: 'strict'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(1);
    expect(output.kernel.cycles[0].statements).toHaveLength(2);
  });

  it('preserves same-PE order while compacting', () => {
    const input = program([
      cycle(0, [at(0, 0, 'SADD', ['R1', 'R0', '1'])]),
      cycle(1, [at(0, 1, 'SADD', ['R2', 'R0', '1'])]),
      cycle(2, [at(0, 0, 'SADD', ['R1', 'R1', '1'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 2,
      memoryReorderPolicy: 'strict'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(2);
    const firstCycleCoords = output.kernel.cycles[0].statements.map((stmt: any) => [stmt.row, stmt.col]);
    const secondCycleCoords = output.kernel.cycles[1].statements.map((stmt: any) => [stmt.row, stmt.col]);
    expect(firstCycleCoords).toContainEqual([0, 0]);
    expect(secondCycleCoords).toContainEqual([0, 0]);
  });

  it('remaps numeric branch targets when intermediate noop cycles are removed', () => {
    const input = program([
      cycle(0, [at(0, 0, 'BEQ', ['R0', '0', '3'])]),
      cycle(1, []),
      cycle(2, [at(0, 1, 'SADD', ['R2', 'R3', 'ZERO'])]),
      cycle(3, [at(0, 0, 'BNE', ['R1', '0', '0'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 1,
      memoryReorderPolicy: 'strict'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(3);
    const branch = output.kernel.cycles[0].statements.find(
      (stmt: any) => stmt.instruction.opcode === 'BEQ'
    );
    expect(branch).toBeTruthy();
    expect(branch.instruction.operands[2]).toBe('2');
  });

  it('allows ROUT writers to move in non-strict policy when no incoming consumers are crossed', () => {
    const input = program([
      cycle(0, [at(0, 0, 'SADD', ['R1', 'R0', '1'])]),
      cycle(1, [at(0, 1, 'SADD', ['ROUT', 'R2', 'ZERO'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 1,
      memoryReorderPolicy: 'same-address-fence'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(1);
    const opcodes = output.kernel.cycles[0].statements.map((stmt: any) => stmt.instruction.opcode);
    expect(opcodes).toContain('SADD');
  });

  it('allows ROUT writers to move in strict policy when no incoming or route writers are crossed', () => {
    const input = program([
      cycle(0, [at(0, 0, 'SADD', ['R1', 'R0', '1'])]),
      cycle(1, [at(0, 1, 'SADD', ['ROUT', 'R2', 'ZERO'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 1,
      memoryReorderPolicy: 'strict'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(1);
    const routPlacement = output.kernel.cycles[0].statements.find(
      (stmt: any) => stmt.row === 0 && stmt.col === 1
    );
    expect(routPlacement?.instruction.operands[0]).toBe('ROUT');
  });

  it('does not move ROUT writers across incoming-read cycles', () => {
    const input = program([
      cycle(0, [at(0, 0, 'SADD', ['R1', 'R0', '1'])]),
      cycle(1, [at(0, 1, 'SADD', ['R2', 'RCL', 'ZERO'])]),
      cycle(2, [at(0, 2, 'SADD', ['ROUT', 'R3', 'ZERO'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 2,
      memoryReorderPolicy: 'same-address-fence'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    expect(output.kernel.cycles).toHaveLength(3);
    const tail = output.kernel.cycles[2].statements.find(
      (stmt: any) => stmt.row === 0 && stmt.col === 2
    );
    expect(tail?.instruction.operands[0]).toBe('ROUT');
  });

  it('keeps ROUT writers ordered under strict policy', () => {
    const input = program([
      cycle(0, [at(0, 0, 'SADD', ['R1', 'R0', '1'])]),
      cycle(1, [at(0, 1, 'SADD', ['ROUT', 'R2', 'ZERO'])]),
      cycle(2, [at(0, 2, 'SADD', ['ROUT', 'R3', 'ZERO'])])
    ]);

    const pass = createSlotPackPass(grid, {
      window: 2,
      memoryReorderPolicy: 'strict'
    });
    const output = pass.run(input, { diagnostics: [] }).output;

    const firstRouteCycle = output.kernel.cycles.findIndex((cycleNode: any) =>
      cycleNode.statements.some((stmt: any) => stmt.row === 0 && stmt.col === 1)
    );
    const secondRouteCycle = output.kernel.cycles.findIndex((cycleNode: any) =>
      cycleNode.statements.some((stmt: any) => stmt.row === 0 && stmt.col === 2)
    );

    expect(firstRouteCycle).toBeGreaterThanOrEqual(0);
    expect(secondRouteCycle).toBeGreaterThan(firstRouteCycle);
  });
});
