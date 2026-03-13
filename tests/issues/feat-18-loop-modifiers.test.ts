import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('FEAT-18 loop modifiers: unroll/collapse', () => {
  it('expands collapse(2) in deterministic row-major order', () => {
    const source = `
target "uma-cgra-base";
build {
  optimize O0;
  prune_noop_cycles off;
}
kernel "collapse_row_major" {
  for i in range(0, 2) collapse(2) {
    for j in range(0, 2) {
      bundle { @i,j: NOP; }
    }
  }
}
`;

    const result = compile(source, { emitArtifacts: ['mir'] });
    expect(result.success).toBe(true);

    const placements = result.artifacts.mir?.cycles.map((cycle) => {
      const slot = cycle.slots[0];
      return slot ? `${slot.row},${slot.col}` : 'none';
    });

    expect(placements).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('accepts unroll(k) on static loops and preserves deterministic output', () => {
    const source = `
target "uma-cgra-base";
build {
  optimize O0;
  prune_noop_cycles off;
}
kernel "unroll_static" {
  for i in range(0, 4) unroll(2) {
    bundle { @0,i: NOP; }
  }
}
`;

    const first = compile(source, { emitArtifacts: ['csv'] });
    const second = compile(source, { emitArtifacts: ['csv'] });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.artifacts.csv).toBe(second.artifacts.csv);
  });

  it('rejects collapse(n) when nested static loop depth is insufficient', () => {
    const source = `
target "uma-cgra-base";
kernel "collapse_insufficient_depth" {
  for i in range(0, 2) collapse(2) {
    bundle { @0,i: NOP; }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('collapse(2)'))).toBe(true);
  });

  it('rejects runtime loop modifiers in phase-1 semantics', () => {
    const runtimeCollapse = compile(`
target "uma-cgra-base";
kernel "runtime_collapse" {
  for R0 in range(0, 2) at @0,0 runtime collapse(2) {
    bundle { @0,1: NOP; }
  }
}
`);
    expect(runtimeCollapse.success).toBe(false);
    expect(runtimeCollapse.diagnostics.some((d) => d.message.includes('collapse(n)'))).toBe(true);

    const runtimeUnroll = compile(`
target "uma-cgra-base";
kernel "runtime_unroll" {
  for R0 in range(0, 2) at @0,0 runtime unroll(2) {
    bundle { @0,1: NOP; }
  }
}
`);
    expect(runtimeUnroll.success).toBe(false);
    expect(runtimeUnroll.diagnostics.some((d) => d.message.includes('unroll(k)'))).toBe(true);
  });
});
