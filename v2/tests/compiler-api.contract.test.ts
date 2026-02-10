import { describe, expect, it } from 'vitest';
import { compile, parse, ErrorCodes } from '@openedge/compiler-api';

describe('compiler-api v2 contracts', () => {
  it('requires target declaration', () => {
    const source = `
kernel "missing_target" {
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = parse(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.MissingTarget)).toBe(true);
  });

  it('desugars C-like arithmetic and memory load/store in cycle statements', () => {
    const source = `
target "uma-cgra-v1";
kernel "mem_sugar" {
  cycle {
    @0,0: R1 = R0 + R0;
    @0,1: R2 = [360 + i*4];
    @0,2: [360 + i*4] = R2;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.mir?.cycles).toHaveLength(1);

    const slots = result.artifacts.mir?.cycles[0].slots ?? [];
    expect(slots.map((s) => s.instruction.opcode)).toEqual(['SADD', 'LWI', 'SWI']);
    expect(slots[1].instruction.operands).toEqual(['R2', '360 + i*4']);
    expect(slots[2].instruction.operands).toEqual(['R2', '360 + i*4']);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 R0');
    expect(result.artifacts.csv).toContain('0,0,1,LWI R2 360 + i*4');
    expect(result.artifacts.csv).toContain('0,0,2,SWI R2 360 + i*4');
  });

  it('keeps top-level .data directives, resolves literal indices, and exposes memory regions', () => {
    const source = `
target "uma-cgra-v1";
.data A { 10, 20, 30, 40 }
kernel "data_regions" {
  cycle {
    @0,0: R1 = A[2];
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const slots = result.artifacts.mir?.cycles[0].slots ?? [];
    expect(slots).toHaveLength(1);
    expect(slots[0].instruction.opcode).toBe('LWI');
    expect(slots[0].instruction.operands).toEqual(['R1', '8']);

    expect(result.artifacts.memoryRegions).toEqual([
      { name: 'A', start: 0, values: [10, 20, 30, 40] }
    ]);
    expect(result.artifacts.csv).toContain('0,0,0,LWI R1 8');
  });

  it('rejects non-literal .data index in v2 baseline', () => {
    const source = `
target "uma-cgra-v1";
.data A { 10, 20, 30, 40 }
kernel "dynamic_data_idx" {
  cycle {
    @0,0: R1 = A[i];
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('broadcasts row statements according to target grid and supports NxM override', () => {
    const source = `
target "uma-cgra-v2";
kernel "row_broadcast" {
  cycle {
    row 0: SADD R0, ZERO, IMM(1);
  }
}
`;

    const defaultGrid = compile(source, { targetProfile: 'uma-cgra-v2' });
    expect(defaultGrid.success).toBe(true);
    expect(defaultGrid.stats.instructions).toBe(8);

    const smallGrid = compile(source, {
      targetProfile: 'uma-cgra-v2',
      grid: { rows: 2, cols: 2, topology: 'mesh' }
    });
    expect(smallGrid.success).toBe(true);
    expect(smallGrid.stats.instructions).toBe(2);
    expect(smallGrid.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(1)');
    expect(smallGrid.artifacts.csv).toContain('0,0,1,SADD R0 ZERO IMM(1)');
  });

  it('reports cycle collisions when multiple statements write same PE', () => {
    const source = `
target "uma-cgra-v1";
kernel "collision" {
  cycle {
    @0,0: SADD R0, ZERO, IMM(1);
    row 0: SADD R1, ZERO, IMM(2);
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.Collision)).toBe(true);
  });

  it('rejects memory-to-memory assignment in memory sugar', () => {
    const source = `
target "uma-cgra-v1";
kernel "mem2mem" {
  cycle {
    @0,0: A[i] = B[i];
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidAssignment)).toBe(true);
  });

  it('accepts compact route pragma syntax as inert metadata in v2 baseline', () => {
    const source = `
target "uma-cgra-v1";
kernel "route_pragma" {
  #pragma route @0,1 -> @0,0 payload(R3) accum(R1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.mir?.cycles[0].slots[0].instruction.opcode).toBe('EXIT');
  });
});
