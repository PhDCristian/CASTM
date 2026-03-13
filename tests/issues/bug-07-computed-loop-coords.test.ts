import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

describe('issues/BUG-7 computed loop coordinates', () => {
  it('compiles variable coordinates inside canonical for loops', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "bug7_var_coords" {
  for i in range(4) {
    bundle { @0,i: NOP; }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,NOP');
    expect(result.artifacts.csv).toContain('1,0,1,NOP');
    expect(result.artifacts.csv).toContain('2,0,2,NOP');
    expect(result.artifacts.csv).toContain('3,0,3,NOP');
  });

  it('compiles computed coordinates inside canonical for loops', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "bug7_expr_coords" {
  for k in range(16) {
    bundle { @k/4,k%4: NOP; }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,NOP');
    expect(result.artifacts.csv).toContain('5,1,1,NOP');
    expect(result.artifacts.csv).toContain('10,2,2,NOP');
    expect(result.artifacts.csv).toContain('15,3,3,NOP');
  });

  it('rejects unresolved computed coordinates outside expansion context', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "bug7_unresolved" {
  bundle { @0,i: NOP; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E3011')).toBe(true);
  });
});
