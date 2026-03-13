import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

describe('compiler-api canonical contracts', () => {
  it('requires target declaration in canonical syntax', () => {
    const source = `
kernel "missing_target" {
  bundle {
    @0,0: NOP;
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.MissingTarget)).toBe(true);
  });

  it('compiles unified let declarations and resolves memory symbols', () => {
    const source = `
target "uma-cgra-base";
let MASK = 0xFFFF;
let acc = R1;
let A = { 10, 20, 30, 40 };
let B @100 = { 0, 0, 0 };
let M[2][2] = { 1, 2, 3, 4 };
kernel "decls" {
  bundle {
    @0,0: R0 = A[1];
    @0,1: B[2] = R0;
    @0,2: R2 = M[1][1];
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('LWI R0 4');
    expect(result.artifacts.csv).toContain('SWI R0 108');
    expect(result.artifacts.csv).toContain('LWI R2 124');
    expect(result.artifacts.symbols?.constants.MASK).toBe('0xFFFF');
    expect(result.artifacts.symbols?.aliases.acc).toBe('R1');
  });

  it('supports memory sugar with raw addresses', () => {
    const source = `
target "uma-cgra-base";
kernel "raw_mem" {
  bundle {
    @0,0: [360 + i*4] = R1;
    @0,1: R1 = [360 + i*4];
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SWI R1 360 + i*4');
    expect(result.artifacts.csv).toContain('LWI R1 360 + i*4');
  });

  it('rejects memory-to-memory assignments', () => {
    const source = `
target "uma-cgra-base";
let A = { 1, 2, 3 };
let B = { 4, 5, 6 };
kernel "mem2mem" {
  bundle {
    @0,0: A[0] = B[1];
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidAssignment)).toBe(true);
  });

  it('accepts canonical spatial namespace forms', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "spatial" {
  bundle {
    at row 0: NOP;
  }
  bundle {
    at col 1: NOP;
  }
  bundle {
    at all: NOP;
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,NOP');
    expect(result.artifacts.csv).toContain('1,3,1,NOP');
    expect(result.artifacts.csv).toContain('2,3,3,NOP');
  });

  it('accepts if/while with explicit control location syntax', () => {
    const source = `
target "uma-cgra-base";
kernel "ctrl" {
  if (R0 == 0) at @0,0 {
    bundle { @0,1: R1 = R1 + 1; }
  } else {
    bundle { @0,1: R1 = R1 + 2; }
  }
  while (R1 < 3) at @0,0 {
    bundle { @0,1: R1 = R1 + 1; }
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('BNE R0 0');
    expect(result.artifacts.csv).toContain('BGE RCR 3');
  });

  it('supports runtime for loops as explicit syntax', () => {
    const source = `
target "uma-cgra-base";
kernel "runtime_for" {
  for R0 in range(0, 3) at @0,0 runtime {
    bundle { @0,1: R1 = R0 + 1; }
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SADD R0 ZERO ZERO');
    expect(result.artifacts.csv).toContain('BGE R0 3');
  });

  it('supports static loop modifiers unroll/collapse in canonical headers', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "loop_modifiers" {
  for i in range(0, 2) unroll(2) collapse(2) {
    for j in range(0, 2) {
      bundle { @i,j: NOP; }
    }
  }
}
`;
    const result = compile(source, { emitArtifacts: ['mir'] });
    expect(result.success).toBe(true);
    expect(result.stats.cycles).toBe(4);
    expect(result.stats.instructions).toBe(4);
    expect(result.stats.activeSlots).toBe(4);
    expect(result.stats.totalSlots).toBe(64);
    expect(result.stats.utilization).toBe(4 / 64);
    expect(result.stats.estimatedCriticalCycles).toBe(4);
    expect(result.stats.schedulerMode).toBe('safe');
  });

  it('rejects collapse(n) when nested static loops are insufficient', () => {
    const source = `
target "uma-cgra-base";
kernel "bad_collapse" {
  for i in range(0, 2) collapse(2) {
    bundle { @0,i: NOP; }
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('collapse(2)'))).toBe(true);
  });

  it('lowers route statement syntax to existing route engine', () => {
    const source = `
target "uma-cgra-base";
kernel "route_stmt" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SADD ROUT R3 ZERO');
    expect(result.artifacts.csv).toContain('SADD R1 R1 RCR');
  });

  it('supports route custom op statement syntax', () => {
    const source = `
target "uma-cgra-base";
kernel "route_custom_stmt" {
  route(@0,0 -> @1,1, payload=R3, dest=R1, op=SMUL(R1, R0, INCOMING));
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SMUL R1');
  });

  it('rejects non-canonical route coordinates', () => {
    const source = `
target "uma-cgra-base";
kernel "route_non_canonical" {
  route((0,1) -> (0,0), payload=R3, accum=R1);
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('supports key-value reduce and scan statements', () => {
    const source = `
target "uma-cgra-base";
kernel "advanced" {
  reduce(op=add, dest=R1, src=R0, axis=row);
  scan(op=add, src=R0, dest=R2, dir=right, mode=exclusive);
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('SADD R2 ZERO 0');
  });

  it('emits structuredAst artifact for canonical pipeline phase boundary', () => {
    const source = `
target "uma-cgra-base";
kernel "structured_boundary" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
  bundle { @0,0: NOP; }
}
`;
    const result = compile(source, { emitArtifacts: ['structured', 'ast'] });
    expect(result.success).toBe(true);
    expect(result.artifacts.structuredAst).toBeDefined();
    expect(result.artifacts.structuredAst?.kernel?.body.some((stmt) => stmt.kind === 'advanced')).toBe(true);
    expect(result.artifacts.structuredAst?.kernel?.body.some((stmt) => stmt.kind === 'cycle')).toBe(true);
  });

  it('records semantic and staged lowering phases in compile stats', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
}
kernel "phase_trace" {
  bundle { @0,0: NOP; }
}
`;
    const result = compile(source, { emitArtifacts: ['ast', 'hir', 'mir', 'lir'] });
    expect(result.success).toBe(true);
    expect(result.stats.loweredPasses).toContain('semantic-checker');
    expect(result.stats.loweredPasses).toContain('semantic-resolver');
    expect(result.stats.loweredPasses.some((name) => name.startsWith('desugar+pragmas:'))).toBe(true);
    expect(result.stats.loweredPasses.some((name) => name.startsWith('resolve+validate:'))).toBe(true);
    expect(result.stats.schedulerMode).toBe('safe');
    expect(result.stats.totalSlots).toBeGreaterThanOrEqual(result.stats.activeSlots);
  });

  it('reports deterministic scheduler mode in compile stats', () => {
    const source = `
target "uma-cgra-base";
kernel "scheduler_mode_trace" {
  bundle { @0,0: SADD R1, R0, 1; }
  bundle { @0,1: SADD R2, R0, 1; }
}
`;
    const balancedSource = source.replace(
      'kernel "scheduler_mode_trace" {',
      'build { scheduler balanced; }\nkernel "scheduler_mode_trace" {'
    );
    const first = compile(balancedSource);
    const second = compile(balancedSource);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.stats.schedulerMode).toBe('balanced');
    expect(first.stats.loweredPasses).toContain('scheduler:balanced');
    expect(first.artifacts.csv).toBe(second.artifacts.csv);

    const safeSource = source.replace(
      'kernel "scheduler_mode_trace" {',
      'build { scheduler safe; }\nkernel "scheduler_mode_trace" {'
    );
    const safe = compile(safeSource);
    expect(safe.success).toBe(true);
    expect(first.stats.cycles).toBeLessThanOrEqual(safe.stats.cycles);
  });

  it('rejects legacy declarations', () => {
    const source = `
target "uma-cgra-base";
.const X 10
kernel "legacy_decl" {
  bundle { @0,0: NOP; }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('rejects legacy pragmas', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_pragma" {
  #pragma route @0,1 -> @0,0 payload(R3) accum(R1)
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('rejects legacy control pragmas', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_control_pragma" {
  #pragma unroll(4)
  for i in range(0, 4) {
    bundle { @0,0: NOP; }
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('rejects legacy auto_cycle pragmas', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_auto_cycle" {
  #pragma auto_cycle
  @0,0: NOP;
  #pragma end_auto_cycle
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('rejects legacy spatial namespace without at', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_spatial" {
  bundle { row 0: NOP; }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('rejects legacy control-location headers without at', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_ctrl" {
  if (R0 == IMM(0)) @0,0 {
    bundle { @0,1: NOP; }
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('rejects legacy for-loop control-location headers without at', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_for" {
  for R0 in range(0, 2) @0,0 runtime {
    bundle { @0,1: NOP; }
  }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('prunes noop-only unlabeled cycles when safe to do so', () => {
    const source = `
target "uma-cgra-base";
kernel "noop_prune" {
  bundle { at @0,0: NOP; }
  bundle { at @0,0: R1 = R0 + 1; }
}
`;
    const result = compile(source, { emitArtifacts: ['mir', 'csv'], pruneNoopCycles: true });
    expect(result.success).toBe(true);
    expect(result.stats.cycles).toBe(1);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 1');
  });

  it('keeps noop-only cycles when numeric branch targets exist', () => {
    const source = `
target "uma-cgra-base";
kernel "noop_prune_guarded" {
  bundle { at @0,0: BEQ R0, 0, 1; }
  bundle { at @0,0: NOP; }
}
`;
    const result = compile(source, { emitArtifacts: ['mir', 'csv'], pruneNoopCycles: true });
    expect(result.success).toBe(true);
    expect(result.stats.cycles).toBe(2);
    expect(result.artifacts.csv).toContain('0,0,0,BEQ R0 0 1');
  });
});
