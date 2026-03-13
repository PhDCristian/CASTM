import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-12 collect statement', () => {
  it('collects adjacent row values and combines with local register', () => {
    const source = `
target "uma-cgra-base";
kernel "feat12_row_add" {
  collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const lines = csvRows(result.artifacts.csv ?? '');
    expect(lines).toHaveLength(8);
    expect(lines).toContain('0,0,0,SADD R3 RCB ZERO');
    expect(lines).toContain('0,0,3,SADD R3 RCB ZERO');
    expect(lines).toContain('1,0,0,SADD R3 R2 R3');
    expect(lines).toContain('1,0,3,SADD R3 R2 R3');
  });

  it('supports shift_add combine form with deterministic lane prefix behavior', () => {
    const source = `
target "uma-cgra-base";
kernel "feat12_shift_add" {
  collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=shift_add);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('1,0,0,SADD R3 R2 ZERO');
    expect(csv).toContain('1,0,1,SADD R3 R2 RCL');
    expect(csv).toContain('1,0,3,SADD R3 R2 RCL');
  });

  it('supports column collection in NxM grids', () => {
    const source = `
target "uma-cgra-base";
build {
  grid 3x5 mesh;
}
kernel "feat12_col_xor" {
  collect(from=col(2), to=col(1), via=RCR, local=R4, into=R5, combine=xor);
}
`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const lines = csvRows(result.artifacts.csv ?? '');
    expect(lines).toHaveLength(6);
    expect(lines).toContain('0,0,1,SADD R5 RCR ZERO');
    expect(lines).toContain('1,2,1,LXOR R5 R4 R5');
  });

  it('emits diagnostics for invalid collect geometry or via direction', () => {
    const wrongVia = compile(`
target "uma-cgra-base";
kernel "feat12_wrong_via" {
  collect(from=row(1), to=row(0), via=RCL, local=R2, into=R3, combine=add);
}
`);

    expect(wrongVia.success).toBe(false);
    expect(wrongVia.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const nonAdjacent = compile(`
target "uma-cgra-base";
kernel "feat12_non_adjacent" {
  collect(from=row(3), to=row(0), via=RCB, local=R2, into=R3, combine=add);
}
`);
    expect(nonAdjacent.success).toBe(false);
    expect(nonAdjacent.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidCollectPath)).toBe(true);

    const outOfBounds = compile(`
target "uma-cgra-base";
kernel "feat12_oob" {
  collect(from=col(9), to=col(0), via=SELF, local=R2, into=R3, combine=copy);
}
`);
    expect(outOfBounds.success).toBe(false);
    expect(outOfBounds.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });
});
