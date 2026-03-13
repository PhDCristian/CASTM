import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvDataLines(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-6 triangle statement', () => {
  it('lowers upper inclusive triangle to deterministic row-major placements', () => {
    const source = `
target "uma-cgra-base";
kernel "feat6_upper" {
  triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    const lines = csvDataLines(csv);

    expect(lines).toHaveLength(10);
    expect(csv).toContain('0,0,0,SMUL R2 R0 R1');
    expect(csv).toContain('0,3,3,SMUL R2 R0 R1');
    expect(csv).not.toContain('0,1,0,SMUL R2 R0 R1');
  });

  it('supports lower exclusive triangle selection', () => {
    const source = `
target "uma-cgra-base";
kernel "feat6_lower_exclusive" {
  triangle(shape=lower, inclusive=false, op=SADD, dest=R3, srcA=R1, srcB=R2);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    const lines = csvDataLines(csv);

    expect(lines).toHaveLength(6);
    expect(csv).toContain('0,1,0,SADD R3 R1 R2');
    expect(csv).toContain('0,3,2,SADD R3 R1 R2');
    expect(csv).not.toContain('0,0,0,SADD R3 R1 R2');
    expect(csv).not.toContain('0,0,1,SADD R3 R1 R2');
  });

  it('uses current grid dimensions (NxM) when expanding the pattern', () => {
    const source = `
target "uma-cgra-base";
build {
  grid 2x4 mesh;
}
kernel "feat6_nxm" {
  triangle(shape=upper, inclusive=true, op=NOP);
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);

    const fixedSource = `
target "uma-cgra-base";
build {
  grid 2x4 mesh;
}
kernel "feat6_nxm_fixed" {
  triangle(shape=upper, inclusive=true, op=SADD, dest=R1, srcA=R0, srcB=ZERO);
}
`;
    const fixed = compile(fixedSource);

    expect(fixed.success).toBe(true);
    const csv = fixed.artifacts.csv ?? '';
    const lines = csvDataLines(csv);
    expect(lines).toHaveLength(7);
    expect(csv).toContain('0,0,3,SADD R1 R0 ZERO');
    expect(csv).toContain('0,1,1,SADD R1 R0 ZERO');
    expect(csv).not.toContain('0,1,0,SADD R1 R0 ZERO');
  });

  it('emits a clear parse diagnostic for malformed triangle arguments', () => {
    const source = `
target "uma-cgra-base";
kernel "feat6_bad" {
  triangle(shape=diag, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
