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

  it('supports extended C-like operator desugaring from v1 syntax', () => {
    const source = `
target "uma-cgra-v1";
kernel "clike_extended_ops" {
  cycle {
    @0,0: R0 = R1 ** R2;
    @0,1: R0 = R1 >>> 1;
    @0,2: R0 = R1 ~& R2;
    @0,3: R0 = R1 ~| R2;
  }
  cycle {
    @0,0: R0 = R1 ~^ R2;
    @0,1: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,FXPMUL R0 R1 R2');
    expect(result.artifacts.csv).toContain('0,0,1,SRA R0 R1 1');
    expect(result.artifacts.csv).toContain('0,0,2,LNAND R0 R1 R2');
    expect(result.artifacts.csv).toContain('0,0,3,LNOR R0 R1 R2');
    expect(result.artifacts.csv).toContain('1,0,0,LXNOR R0 R1 R2');
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
    expect(result.artifacts.assertions).toEqual([
      {
        cycle: 0,
        row: 0,
        col: 0,
        register: 'R1',
        value: 30,
        raw: '.assert cycle=0 @0,0 R1 == 30',
        span: expect.any(Object)
      }
    ]);
    expect(result.artifacts.lir?.cycles).toHaveLength(1);
    expect(result.artifacts.csv).toContain('0,0,0,LWI R1 8');
  });

  it('parses .assert object payload and infers cycle from source position when omitted', () => {
    const source = `
target "uma-cgra-v1";
kernel "assert_object_form" {
  cycle {
    @0,0: SADD R1, ZERO, IMM(42);
  }
  .assert { location: 0,0, register: R1, value: 42 }
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.assertions).toEqual([
      {
        cycle: 0,
        row: 0,
        col: 0,
        register: 'R1',
        value: 42,
        raw: '.assert { location: 0,0, register: R1, value: 42 }',
        span: expect.any(Object)
      }
    ]);
  });

  it('parses .io_load/.io_store payloads in brace form', () => {
    const source = `
target "uma-cgra-v1";
kernel "io_brace_form" {
  .io_load { 300, 304, 308 }
  .io_store { 400, 404 }
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.ioConfig).toEqual({
      loadAddrs: [300, 304, 308],
      storeAddrs: [400, 404]
    });
  });

  it('rejects negative addresses in .io_load/.io_store directives', () => {
    const source = `
target "uma-cgra-v1";
kernel "io_negative_addr" {
  .io_load -1, 100
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('rejects invalid .assert payloads with parse diagnostics', () => {
    const source = `
target "uma-cgra-v1";
kernel "assert_invalid" {
  .assert cycle=foo @0,0 R1 == 30
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.artifacts.assertions).toEqual([]);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('parses .limit and exposes cycleLimit artifact', () => {
    const source = `
target "uma-cgra-v1";
.limit 5
kernel "limit_ok" {
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.cycleLimit).toBe(5);
    expect(result.stats.cycles).toBe(1);
  });

  it('fails when generated cycles exceed .limit', () => {
    const source = `
target "uma-cgra-v1";
.limit 1
kernel "limit_exceeded" {
  #pragma allreduce(sum, R1, R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('rejects invalid .limit payload', () => {
    const source = `
target "uma-cgra-v1";
.limit abc
kernel "limit_invalid" {
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('supports non-literal .data index expressions in memory sugar', () => {
    const source = `
target "uma-cgra-v1";
.data A { 10, 20, 30, 40 }
kernel "dynamic_data_idx" {
  cycle {
    @0,0: R1 = A[i];
    @0,1: A[i + 1] = R2;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,LWI R1 0 + (i) * 4');
    expect(result.artifacts.csv).toContain('0,0,1,SWI R2 0 + (i+1) * 4');
  });

  it('parses .data2d declarations and exposes dimensional symbols', () => {
    const source = `
target "uma-cgra-v1";
.data2d M[2][3] { 1, 2, 3, 4, 5, 6 }
.data2d Z[4]
kernel "data2d_regions" {
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.memoryRegions).toEqual([
      { name: 'M', start: 0, values: [1, 2, 3, 4, 5, 6], rows: 2, cols: 3 },
      { name: 'Z', start: 24, values: [0, 0, 0, 0], rows: 2, cols: 2 }
    ]);
    expect(result.artifacts.symbols?.arrays).toEqual([
      { name: 'M', start: 0, length: 6, rows: 2, cols: 3 },
      { name: 'Z', start: 24, length: 4, rows: 2, cols: 2 }
    ]);
  });

  it('resolves literal .data2d indices in memory sugar', () => {
    const source = `
target "uma-cgra-v1";
.data2d M[2][2] { 10, 20, 30, 40 }
kernel "data2d_access" {
  cycle {
    @0,0: R1 = M[1][0];
    @0,1: M[0][1] = R2;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,LWI R1 8');
    expect(result.artifacts.csv).toContain('0,0,1,SWI R2 4');
  });

  it('supports non-literal .data2d indices in memory sugar', () => {
    const source = `
target "uma-cgra-v1";
.data2d M[2][2] { 10, 20, 30, 40 }
kernel "data2d_dynamic_idx" {
  cycle {
    @0,0: R1 = M[i][j];
    @0,1: M[i + 1][j] = R2;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,LWI R1 0 + (((i) * 2) + (j)) * 4');
    expect(result.artifacts.csv).toContain('0,0,1,SWI R2 0 + (((i+1) * 2) + (j)) * 4');
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

  it('supports kernel-level for loops with default compile-time unrolling', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_for_unroll_default" {
  for i in range(3) {
    cycle { @0,0: SADD R0, ZERO, IMM(i); }
  }
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R0 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('2,0,0,SADD R0 ZERO IMM(2)');
    expect(result.artifacts.csv).toContain('3,0,0,EXIT');
  });

  it('applies #pragma unroll(N) truncation in baseline behavior', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_for_unroll_factor" {
  #pragma unroll(2)
  for i in range(5) {
    cycle { @0,0: SADD R0, ZERO, IMM(i); }
  }
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R0 ZERO IMM(1)');
    expect(result.artifacts.csv).not.toContain('IMM(2)');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('lowers #pragma no_unroll for register-controlled runtime loops (standard path)', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_for_no_unroll_standard" {
  #pragma no_unroll
  for R0 in range(0, 3) @0,0 {
    cycle { @0,0: SADD R1, R1, R0; }
  }
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SADD R0 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('BGE R0 IMM(3)');
    expect(result.artifacts.csv).toContain('SADD R1 R1 R0');
    expect(result.artifacts.csv).toContain('SADD R0 R0 IMM(1)');
    expect(result.artifacts.csv).toContain('JUMP');
    expect(result.artifacts.csv).toContain('EXIT');
    expect(result.stats.cycles).toBe(6);
  });

  it('uses aggressive #pragma no_unroll lowering for adjacent single-cycle body', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_for_no_unroll_aggressive" {
  #pragma no_unroll
  for R0 in range(0, 3) @0,0 {
    cycle { @0,1: SADD R1, R1, R0; }
  }
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('BGE R0 IMM(3)');
    expect(result.artifacts.csv).toContain('SADD R3 RCL ZERO');
    expect(result.artifacts.csv).toContain('SADD R1 R1 R3');
    expect(result.artifacts.csv).toContain('SADD R0 R0 IMM(1)');
    expect(result.stats.cycles).toBe(5);
  });

  it('rejects #pragma no_unroll when loop variable is not a register', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_for_no_unroll_invalid_var" {
  #pragma no_unroll
  for i in range(0, 3) {
    cycle { @0,0: EXIT; }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('collapses kernel for-loop iterations with #pragma parallel collapse', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_for_parallel_collapse" {
  #pragma parallel collapse
  for i in range(2) {
    cycle { @0,i: SADD R0, ZERO, IMM(i); }
    cycle { @1,i: SADD R1, ZERO, IMM(i); }
  }
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('0,0,1,SADD R0 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('1,1,0,SADD R1 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('1,1,1,SADD R1 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('supports #pragma parallel collapse(2) across two nested loop levels', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_for_parallel_collapse2" {
  #pragma parallel collapse(2)
  for i in range(2) {
    for j in range(2) {
      cycle { @i,j: SADD R0, ZERO, IMM(i); }
      cycle { @i,j: SADD R1, ZERO, IMM(j); }
    }
  }
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('0,0,1,SADD R0 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('0,1,0,SADD R0 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('0,1,1,SADD R0 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R1 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('1,0,1,SADD R1 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('1,1,0,SADD R1 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('1,1,1,SADD R1 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('makes #pragma no_fuse affect while-loop lowering', () => {
    const baseSource = `
target "uma-cgra-v1";
kernel "kernel_while_fused" {
  while (R0 < IMM(2)) @0,0 {
    cycle { @0,1: SADD R1, R1, IMM(1); }
  }
  cycle { @0,0: EXIT; }
}
`;
    const noFuseSource = `
target "uma-cgra-v1";
kernel "kernel_while_no_fuse" {
  #pragma no_fuse
  while (R0 < IMM(2)) @0,0 {
    cycle { @0,1: SADD R1, R1, IMM(1); }
  }
  cycle { @0,0: EXIT; }
}
`;

    const fused = compile(baseSource);
    const noFuse = compile(noFuseSource);
    expect(fused.success).toBe(true);
    expect(noFuse.success).toBe(true);
    expect(fused.stats.cycles).toBeLessThan(noFuse.stats.cycles);
    expect(noFuse.artifacts.csv).toContain('JUMP');
    expect(fused.artifacts.csv).toContain('JUMP');
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

  it('lowers kernel-level if/else blocks including compact `} else {` form', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_if_else" {
  if (R0 == IMM(1)) @0,0 {
    cycle { @0,1: SADD R1, ZERO, IMM(2); }
  } else {
    cycle { @0,2: SADD R2, ZERO, IMM(3); }
  }
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,BNE R0 IMM(1) 3');
    expect(result.artifacts.csv).toContain('1,0,1,SADD R1 ZERO IMM(2)');
    expect(result.artifacts.csv).toContain('2,0,0,JUMP 5 ZERO');
    expect(result.artifacts.csv).toContain('4,0,2,SADD R2 ZERO IMM(3)');
    expect(result.artifacts.csv).toContain('6,0,0,EXIT');
  });

  it('lowers kernel-level while loops into branch, body, and back-edge cycles', () => {
    const source = `
target "uma-cgra-v1";
kernel "kernel_while" {
  while (R0 < IMM(2)) @0,0 {
    cycle { @0,0: SADD R0, R0, IMM(1); }
  }
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,BGE R0 IMM(2) 3');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R0 R0 IMM(1)');
    expect(result.artifacts.csv).toContain('2,0,0,JUMP 0 ZERO');
    expect(result.artifacts.csv).toContain('4,0,0,EXIT');
  });

  it('supports if lowering inside expanded function bodies with parameter substitution', () => {
    const source = `
target "uma-cgra-v1";
function maybe_inc(dst, src) {
  if (src != ZERO) @0,0 {
    cycle { @0,0: SADD dst, src, IMM(1); }
  }
}
kernel "fn_if" {
  maybe_inc(R2, R1);
  cycle { @0,0: EXIT; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,BEQ R1 ZERO 2');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R2 R1 IMM(1)');
    expect(result.artifacts.csv).toContain('3,0,0,EXIT');
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

  it('lowers route pragma and keeps compact/legacy syntax equivalent', () => {
    const compactSource = `
target "uma-cgra-v1";
kernel "route_compact" {
  #pragma route @0,1 -> @0,0 payload(R3) accum(R1)
  cycle {
    @0,0: EXIT;
  }
}
`;
    const legacySource = `
target "uma-cgra-v1";
kernel "route_legacy" {
  #pragma route (0,1) -> (0,0) payload(R3) accum(R1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const compactResult = compile(compactSource);
    const legacyResult = compile(legacySource);
    expect(compactResult.success).toBe(true);
    expect(legacyResult.success).toBe(true);

    const compactLines = compactResult.artifacts.csv!.trim().split('\n').slice(1, 3);
    const legacyLines = legacyResult.artifacts.csv!.trim().split('\n').slice(1, 3);
    expect(compactLines).toEqual(legacyLines);
    expect(compactResult.artifacts.csv).toContain('0,0,1,SADD ROUT R3 ZERO');
    expect(compactResult.artifacts.csv).toContain('1,0,0,SADD R1 R1 RCR');
    expect(compactResult.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('supports route custom op lowering with INCOMING operand resolution', () => {
    const source = `
target "uma-cgra-v1";
kernel "route_custom_op" {
  #pragma route @0,0 -> @1,1 payload(R3) dest(R1) op(SMUL R1, R0, INCOMING)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD ROUT R3 ZERO');
    expect(result.artifacts.csv).toContain('1,0,1,SADD ROUT RCL ZERO');
    expect(result.artifacts.csv).toContain('2,1,1,SMUL R1 R0 RCT');
    expect(result.artifacts.csv).toContain('3,0,0,EXIT');
  });

  it('uses topology-aware route path (torus wrap vs mesh no-wrap)', () => {
    const source = `
target "uma-cgra-v1";
kernel "route_topology" {
  #pragma route @0,0 -> @0,3 payload(R3) accum(R1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const torusResult = compile(source);
    expect(torusResult.success).toBe(true);
    expect(torusResult.artifacts.csv).toContain('0,0,0,SADD ROUT R3 ZERO');
    expect(torusResult.artifacts.csv).toContain('1,0,3,SADD R1 R1 RCR');
    expect(torusResult.artifacts.csv).toContain('2,0,0,EXIT');

    const meshResult = compile(source, {
      grid: { rows: 4, cols: 4, topology: 'mesh' }
    });
    expect(meshResult.success).toBe(true);
    expect(meshResult.artifacts.csv).toContain('0,0,0,SADD ROUT R3 ZERO');
    expect(meshResult.artifacts.csv).toContain('1,0,1,SADD ROUT RCL ZERO');
    expect(meshResult.artifacts.csv).toContain('2,0,2,SADD ROUT RCL ZERO');
    expect(meshResult.artifacts.csv).toContain('3,0,3,SADD R1 R1 RCL');
    expect(meshResult.artifacts.csv).toContain('4,0,0,EXIT');
  });

  it('lowers broadcast pragma using route-style fanout for row scope', () => {
    const source = `
target "uma-cgra-v1";
kernel "broadcast_row" {
  #pragma broadcast(value=R0, from=@0,0, to=row)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('1,0,1,SADD R0 RCL ZERO');
    expect(result.artifacts.csv).toContain('4,0,2,SADD R0 RCL ZERO');
    expect(result.artifacts.csv).toContain('6,0,3,SADD R0 RCR ZERO');
    expect(result.artifacts.csv).toContain('7,0,0,EXIT');
  });

  it('lowers broadcast pragma for column scope', () => {
    const source = `
target "uma-cgra-v1";
kernel "broadcast_column" {
  #pragma broadcast(value=R0, from=@0,1, to=column)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,1,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('1,1,1,SADD R0 RCT ZERO');
    expect(result.artifacts.csv).toContain('4,2,1,SADD R0 RCT ZERO');
    expect(result.artifacts.csv).toContain('6,3,1,SADD R0 RCB ZERO');
  });

  it('lowers broadcast pragma for all scope', () => {
    const source = `
target "uma-cgra-v1";
kernel "broadcast_all" {
  #pragma broadcast(value=R0, from=@0,0, to=all)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SADD R0 RCL ZERO');
    expect(result.artifacts.csv).toContain('SADD R0 RCT ZERO');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('lowers rotate pragma on row 0 in torus topology', () => {
    const source = `
target "uma-cgra-v1";
kernel "rotate_row0" {
  #pragma rotate(reg=R0, direction=left, distance=1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('0,0,3,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R0 RCR ZERO');
    expect(result.artifacts.csv).toContain('1,0,3,SADD R0 RCR ZERO');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('applies rotate lowering across every row of the grid', () => {
    const source = `
target "uma-cgra-v1";
kernel "rotate_all_rows" {
  #pragma rotate(reg=R0, direction=left, distance=1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,1,0,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('0,3,3,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('1,2,0,SADD R0 RCR ZERO');
    expect(result.artifacts.csv).toContain('1,3,3,SADD R0 RCR ZERO');
  });

  it('rejects rotate pragma on mesh topology for now', () => {
    const source = `
target "uma-cgra-v1";
kernel "rotate_mesh" {
  #pragma rotate(reg=R0, direction=left, distance=1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source, {
      grid: { rows: 4, cols: 4, topology: 'mesh' }
    });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('lowers shift pragma with fill value at edge', () => {
    const source = `
target "uma-cgra-v1";
kernel "shift_row0" {
  #pragma shift(reg=R0, direction=right, distance=1, fill=7)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('0,0,3,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R0 ZERO IMM(7)');
    expect(result.artifacts.csv).toContain('1,0,1,SADD R0 RCL ZERO');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('lowers scan pragma (add, inclusive) across row 0', () => {
    const source = `
target "uma-cgra-v1";
kernel "scan_add_inclusive" {
  #pragma scan(add, R0, R1, right)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('1,0,0,SADD ROUT R1 ZERO');
    expect(result.artifacts.csv).toContain('2,0,1,SADD R1 R1 RCL');
    expect(result.artifacts.csv).toContain('5,0,2,SADD ROUT R1 ZERO');
    expect(result.artifacts.csv).toContain('6,0,3,SADD R1 R1 RCL');
    expect(result.artifacts.csv).toContain('7,0,0,EXIT');
  });

  it('applies horizontal scan lowering across every row', () => {
    const source = `
target "uma-cgra-v1";
kernel "scan_all_rows" {
  #pragma scan(add, R0, R1, right)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,1,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('2,2,1,SADD R1 R1 RCL');
    expect(result.artifacts.csv).toContain('6,3,3,SADD R1 R1 RCL');
  });

  it('lowers scan pragma (add, exclusive) using identity and source relay', () => {
    const source = `
target "uma-cgra-v1";
kernel "scan_add_exclusive" {
  #pragma scan(add, R0, R2, right, exclusive)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R2 ZERO IMM(0)');
    expect(result.artifacts.csv).toContain('1,0,0,SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('2,0,1,SADD R2 R2 RCL');
    expect(result.artifacts.csv).toContain('6,0,3,SADD R2 R2 RCL');
    expect(result.artifacts.csv).toContain('7,0,0,EXIT');
  });

  it('lowers scan pragma max operation using SSUB+BSFA pattern', () => {
    const source = `
target "uma-cgra-v1";
kernel "scan_max" {
  #pragma scan(max, R0, R1, right)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('2,0,1,SSUB R2 R1 RCL');
    expect(result.artifacts.csv).toContain('3,0,1,BSFA R1 RCL R1');
    expect(result.artifacts.csv).toContain('8,0,3,SSUB R2 R1 RCL');
    expect(result.artifacts.csv).toContain('9,0,3,BSFA R1 RCL R1');
    expect(result.artifacts.csv).toContain('10,0,0,EXIT');
  });

  it('lowers scan pragma on vertical direction (down)', () => {
    const source = `
target "uma-cgra-v1";
kernel "scan_down" {
  #pragma scan(add, R0, R1, down)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('2,1,0,SADD R1 R1 RCT');
    expect(result.artifacts.csv).toContain('4,2,0,SADD R1 R1 RCT');
    expect(result.artifacts.csv).toContain('6,3,0,SADD R1 R1 RCT');
    expect(result.artifacts.csv).toContain('7,0,0,EXIT');
  });

  it('rejects unsupported scan operations', () => {
    const source = `
target "uma-cgra-v1";
kernel "scan_bad_op" {
  #pragma scan(median, R0, R1, right)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('lowers reduce pragma sum on row axis', () => {
    const source = `
target "uma-cgra-v1";
kernel "reduce_sum_row" {
  #pragma reduce(sum, R1, R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('SADD R1 R1 R7');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('lowers reduce pragma max with SSUB+BSFA pattern', () => {
    const source = `
target "uma-cgra-v1";
kernel "reduce_max_row" {
  #pragma reduce(max, R1, R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SSUB R6 R1 R7');
    expect(result.artifacts.csv).toContain('BSFA R1 R7 R1 SELF');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('supports reduce axis=col using vertical neighbors', () => {
    const source = `
target "uma-cgra-v1";
kernel "reduce_col_axis" {
  #pragma reduce(sum, R1, R0, axis=col)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('SADD R1 R1 R7');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('supports reduce lowering on wider NxM grids', () => {
    const source = `
target "uma-cgra-v1";
kernel "reduce_grid_unsupported" {
  #pragma reduce(sum, R1, R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source, {
      grid: { rows: 4, cols: 8, topology: 'mesh' }
    });
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SADD R1 R1 R7');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('lowers stencil pragma cross pattern', () => {
    const source = `
target "uma-cgra-v1";
kernel "stencil_cross" {
  #pragma stencil(cross, add, R0, R1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R2 R0 RCT');
    expect(result.artifacts.csv).toContain('0,1,0,SADD R2 R0 RCT');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R2 R2 RCB');
    expect(result.artifacts.csv).toContain('2,0,0,SADD R2 R2 RCL');
    expect(result.artifacts.csv).toContain('3,0,0,SADD R1 R2 RCR');
    expect(result.artifacts.csv).toContain('4,0,0,EXIT');
  });

  it('supports stencil shorthand syntax without explicit operation', () => {
    const source = `
target "uma-cgra-v1";
kernel "stencil_horizontal_short" {
  #pragma stencil(horizontal, R0, R1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R2 R0 RCL');
    expect(result.artifacts.csv).toContain('0,1,0,SADD R2 R0 RCL');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R1 R2 RCR');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('supports stencil vertical pattern', () => {
    const source = `
target "uma-cgra-v1";
kernel "stencil_vertical" {
  #pragma stencil(vertical, avg, R0, R1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R2 R0 RCT');
    expect(result.artifacts.csv).toContain('0,1,0,SADD R2 R0 RCT');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R1 R2 RCB');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('rejects unsupported stencil operations', () => {
    const source = `
target "uma-cgra-v1";
kernel "stencil_bad_op" {
  #pragma stencil(cross, median, R0, R1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('lowers allreduce pragma as reduce + broadcast on row axis', () => {
    const source = `
target "uma-cgra-v1";
kernel "allreduce_sum_row" {
  #pragma allreduce(sum, R1, R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('SADD R1 R1 R7');
    expect(result.artifacts.csv).toContain('SADD ROUT R1 ZERO');
    expect(result.artifacts.csv).toContain('SADD R1 RCL ZERO');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('supports allreduce axis=col using vertical broadcast chain', () => {
    const source = `
target "uma-cgra-v1";
kernel "allreduce_col_axis" {
  #pragma allreduce(sum, R1, R0, axis=col)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('SADD R1 R1 R7');
    expect(result.artifacts.csv).toContain('SADD ROUT R1 ZERO');
    expect(result.artifacts.csv).toContain('SADD R1 RCT ZERO');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('supports allreduce lowering on wider NxM grids', () => {
    const source = `
target "uma-cgra-v1";
kernel "allreduce_grid_unsupported" {
  #pragma allreduce(sum, R1, R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source, {
      grid: { rows: 4, cols: 8, topology: 'mesh' }
    });
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SADD ROUT R1 ZERO');
    expect(result.artifacts.csv).toContain(',0,7,SADD R1');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('lowers transpose pragma for square grids', () => {
    const source = `
target "uma-cgra-v1";
kernel "transpose_row_col_swap" {
  #pragma transpose(reg=R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SADD ROUT R0 ZERO');
    expect(result.artifacts.csv).toContain('SADD R7');
    expect(result.artifacts.csv).toContain('SADD R6');
    expect(result.artifacts.csv).toContain('SADD R0 R7 ZERO');
    expect(result.artifacts.csv).toContain('SADD R0 R6 ZERO');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('rejects transpose on non-square grids', () => {
    const source = `
target "uma-cgra-v1";
kernel "transpose_non_square" {
  #pragma transpose(reg=R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source, {
      grid: { rows: 4, cols: 8, topology: 'mesh' }
    });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('lowers gather pragma to destination accumulation on a row', () => {
    const source = `
target "uma-cgra-v1";
kernel "gather_add_row0" {
  #pragma gather(src=R0, dest=@0,0, destReg=R1, op=add)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('SADD R7');
    expect(result.artifacts.csv).toContain('SADD R1 R1 R7');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('supports gather with non-origin destination and xor operation', () => {
    const source = `
target "uma-cgra-v1";
kernel "gather_xor_dest_col2" {
  #pragma gather(src=R0, dest=@0,2, destReg=R1, op=xor)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,2,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('LXOR R1 R1 R7');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('gathers from the full grid into destination accumulator', () => {
    const source = `
target "uma-cgra-v1";
kernel "gather_full_grid" {
  #pragma gather(src=R0, dest=@1,1, destReg=R2, op=add)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,1,1,SADD R2 R0 ZERO');
    expect(result.artifacts.csv).toContain('SADD R7');
    expect(result.artifacts.csv).toContain('SADD R2 R2 R7');
    expect(result.artifacts.csv).toContain(',0,0,EXIT');
  });

  it('rejects gather with unsupported operation', () => {
    const source = `
target "uma-cgra-v1";
kernel "gather_bad_op" {
  #pragma gather(src=R0, dest=@0,0, destReg=R1, op=max)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('lowers stream_load pragma with default row/count', () => {
    const source = `
target "uma-cgra-v1";
kernel "stream_load_default" {
  #pragma stream_load(dest=R0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,LWD R0');
    expect(result.artifacts.csv).toContain('0,0,3,LWD R0');
    expect(result.artifacts.csv).toContain('1,0,0,EXIT');
  });

  it('supports stream_load with row/count overrides', () => {
    const source = `
target "uma-cgra-v1";
kernel "stream_load_row_count" {
  #pragma stream_load(dest=R1, row=2, count=2)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,2,0,LWD R1');
    expect(result.artifacts.csv).toContain('1,2,3,LWD R1');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('supports stream pragmas on wider NxM grids', () => {
    const source = `
target "uma-cgra-v1";
kernel "stream_nxm" {
  #pragma stream_load(dest=R1, row=1, count=2)
  #pragma stream_store(src=R1, row=1, count=1)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source, {
      grid: { rows: 2, cols: 8, topology: 'mesh' }
    });
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,1,0,LWD R1');
    expect(result.artifacts.csv).toContain('1,1,7,LWD R1');
    expect(result.artifacts.csv).toContain('2,1,7,SWD R1');
    expect(result.artifacts.csv).toContain('3,0,0,EXIT');
  });

  it('lowers stream_store pragma with row/count overrides', () => {
    const source = `
target "uma-cgra-v1";
kernel "stream_store_row_count" {
  #pragma stream_store(src=R2, row=1, count=2)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,1,0,SWD R2');
    expect(result.artifacts.csv).toContain('1,1,3,SWD R2');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('rejects stream pragmas with invalid count', () => {
    const source = `
target "uma-cgra-v1";
kernel "stream_bad_count" {
  #pragma stream_load(dest=R0, count=0)
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('groups auto_cycle statements by PE conflicts', () => {
    const source = `
target "uma-cgra-v1";
kernel "auto_cycle_grouping" {
  #pragma auto_cycle
  @0,0: SADD R0, ZERO, IMM(10);
  @0,1: SADD R0, ZERO, IMM(20);
  @0,0: SADD R1, ZERO, IMM(30);
  @0,1: SADD R1, ZERO, IMM(40);
  #pragma end_auto_cycle
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(10)');
    expect(result.artifacts.csv).toContain('0,0,1,SADD R0 ZERO IMM(20)');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R1 ZERO IMM(30)');
    expect(result.artifacts.csv).toContain('1,0,1,SADD R1 ZERO IMM(40)');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('supports auto_cycle with row-scoped conflict detection', () => {
    const source = `
target "uma-cgra-v1";
kernel "auto_cycle_rows" {
  #pragma auto_cycle
  row 0: SADD R0, ZERO, IMM(1);
  row 1: SADD R0, ZERO, IMM(2);
  row 0: SADD R1, ZERO, IMM(3);
  #pragma end_auto_cycle
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('0,1,3,SADD R0 ZERO IMM(2)');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R1 ZERO IMM(3)');
    expect(result.artifacts.csv).toContain('2,0,0,EXIT');
  });

  it('supports auto_cycle with col/all occupancy conflict detection', () => {
    const source = `
target "uma-cgra-v1";
kernel "auto_cycle_col_all" {
  #pragma auto_cycle
  col 0: SADD R0, ZERO, IMM(1);
  all: SADD R1, ZERO, IMM(2);
  col 0: SADD R2, ZERO, IMM(3);
  #pragma end_auto_cycle
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R0 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('0,3,0,SADD R0 ZERO IMM(1)');
    expect(result.artifacts.csv).toContain('1,0,0,SADD R1 ZERO IMM(2)');
    expect(result.artifacts.csv).toContain('2,0,0,SADD R2 ZERO IMM(3)');
    expect(result.artifacts.csv).toContain('3,0,0,EXIT');
  });

  it('rejects auto_cycle regions without end_auto_cycle', () => {
    const source = `
target "uma-cgra-v1";
kernel "auto_cycle_missing_end" {
  #pragma auto_cycle
  @0,0: SADD R0, ZERO, IMM(10);
  cycle {
    @0,0: EXIT;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('rejects unsupported pragmas by default in strict mode', () => {
    const source = `
target "uma-cgra-v1";
kernel "unknown_pragma" {
  #pragma foobar
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
kernel "unknown_pragma_relaxed" {
  #pragma foobar
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
