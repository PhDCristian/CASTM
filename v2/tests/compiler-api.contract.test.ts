import { describe, expect, it } from 'vitest';
import { compile, emit, parse, ErrorCodes } from '@openedge/compiler-api';

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
.const TILE = 4
.alias ACC = R3
.data A { 10, 20, 30, 40 }
kernel "data_regions" {
  .io_load 100, 104
  .io_store 200
  .assert cycle=0 @0,0 R1 == 30
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
    expect(result.artifacts.symbols).toEqual({
      constants: { TILE: '4' },
      aliases: { ACC: 'R3' },
      arrays: [{ name: 'A', start: 0, length: 4 }],
      labels: {}
    });
    expect(result.artifacts.ioConfig).toEqual({
      loadAddrs: [100, 104],
      storeAddrs: [200]
    });
    expect(result.artifacts.assertions).toHaveLength(1);
    expect(result.artifacts.lir?.cycles).toHaveLength(1);
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

  it('unrolls for loops inside cycle blocks using constants and loop bindings', () => {
    const source = `
target "uma-cgra-v1";
.const N = 2
kernel "for_unroll" {
  cycle {
    for i in range(N) {
      @0,i: SADD R0, ZERO, IMM(i);
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.stats.instructions).toBe(2);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('0,0,1,SADD R0 ZERO IMM(1)');
  });

  it('supports nested for loops in cycle blocks', () => {
    const source = `
target "uma-cgra-v1";
kernel "nested_for" {
  cycle {
    for i in range(2) {
      for j in range(2) {
        @i,j: EXIT;
      }
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.stats.instructions).toBe(4);
    expect(result.artifacts.csv).toContain('0,0,0,EXIT');
    expect(result.artifacts.csv).toContain('0,0,1,EXIT');
    expect(result.artifacts.csv).toContain('0,1,0,EXIT');
    expect(result.artifacts.csv).toContain('0,1,1,EXIT');
  });

  it('detects PE collisions across unrolled for iterations in the same cycle', () => {
    const source = `
target "uma-cgra-v1";
kernel "for_collision" {
  cycle {
    for i in range(2) {
      @0,0: EXIT;
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.Collision)).toBe(true);
  });

  it('reports invalid range step in for loops', () => {
    const source = `
target "uma-cgra-v1";
kernel "for_invalid_range" {
  cycle {
    for i in range(0, 4, 0) {
      @0,0: EXIT;
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('expands function calls with parameter substitution into kernel cycles', () => {
    const source = `
target "uma-cgra-v1";
function extract(dst, src) {
  cycle { @0,0: dst = src >> 16; }
}
kernel "fn_param_expr" {
  cycle { @0,0: SADD R0, ZERO, IMM(65536); }
  extract(R1, R0);
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('1,0,0,SRT R1 R0 16');
  });

  it('expands nested function calls (non-recursive)', () => {
    const source = `
target "uma-cgra-v1";
function load(dst, v) {
  cycle { @0,0: SADD dst, ZERO, IMM(v); }
}
function load_twice(a, b) {
  load(R1, a);
  load(R2, b);
}
kernel "nested_fn_call" {
  load_twice(7, 9);
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 ZERO IMM(7)');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R2 ZERO IMM(9)');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('rejects recursive function expansion', () => {
    const source = `
target "uma-cgra-v1";
function recurse(x) {
  recurse(x);
}
kernel "recursive_fn" {
  recurse(R0);
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('Recursive function call detected'))).toBe(true);
  });

  it('resolves labeled cycle references in branch/jump operands', () => {
    const source = `
target "uma-cgra-v1";
kernel "labels_ok" {
  start: cycle { @0,0: SADD R0, ZERO, IMM(1); }
  cycle { @0,0: BGE R0, IMM(0), start; }
  cycle { @0,0: JUMP start, ZERO; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('1,0,0,BGE R0 IMM(0) 0');
    expect(result.artifacts.csv).toContain('2,0,0,JUMP 0 ZERO');
    expect(result.artifacts.symbols?.labels).toEqual({ start: 0 });
  });

  it('rejects branches to unknown labels', () => {
    const source = `
target "uma-cgra-v1";
kernel "labels_missing" {
  cycle { @0,0: JUMP nowhere, ZERO; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnknownLabel)).toBe(true);
  });

  it('rejects duplicate labeled cycles', () => {
    const source = `
target "uma-cgra-v1";
kernel "labels_dup" {
  loop: cycle { @0,0: EXIT; }
  loop: cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.DuplicateLabel)).toBe(true);
  });

  it('prefixes function-internal labels per expansion to avoid collisions', () => {
    const source = `
target "uma-cgra-v1";
function dec_loop(reg) {
  loop: cycle { @0,0: SSUB reg, reg, IMM(1); }
  cycle { @0,0: BGE reg, IMM(0), loop; }
}
kernel "fn_labels" {
  cycle { @0,0: SADD R0, ZERO, IMM(1); }
  dec_loop(R0);
  cycle { @0,0: SADD R1, ZERO, IMM(1); }
  dec_loop(R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.DuplicateLabel)).toBe(false);
    expect(result.artifacts.csv).toContain('2,0,0,BGE R0 IMM(0) 1');
    expect(result.artifacts.csv).toContain('5,0,0,BGE R1 IMM(0) 4');
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

  it('rejects unsupported pragmas by default in strict mode', () => {
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
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedPragma)).toBe(true);
  });

  it('allows unsupported pragmas in transitional mode and emits simulator matrix CSV', () => {
    const source = `
target "uma-cgra-v1";
kernel "route_pragma_relaxed" {
  #pragma route @0,1 -> @0,0 payload(R3) accum(R1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source, { strictUnsupported: false, emitArtifacts: ['mir', 'lir'] });
    expect(result.success).toBe(true);
    expect(result.artifacts.mir?.cycles[0].slots[0].instruction.opcode).toBe('EXIT');

    const matrix = emit(result.artifacts.lir!, { format: 'sim-matrix-csv' });
    expect(matrix.success).toBe(true);
    expect(matrix.csv?.split('\n')[0]).toBe('0');
    expect(matrix.csv).toContain('"EXIT"');
    expect(matrix.csv).toContain('"NOP"');
  });
});
