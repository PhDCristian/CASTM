import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-5 normalize statement', () => {
  it('normalizes a row lane with default carry propagation to the right', () => {
    const source = `
target "uma-cgra-base";
kernel "feat5_row" {
  normalize(reg=R3, carry=R1, width=16, lane=0);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    const lines = csvRows(csv);
    expect(lines).toHaveLength(16);
    expect(csv).toContain('0,0,0,SRT R1 R3 16');
    expect(csv).toContain('1,0,0,LAND R3 R3 65535');
    expect(csv).toContain('2,0,0,SADD ROUT R1 ZERO');
    expect(csv).toContain('3,0,0,SADD R3 R3 ZERO');
    expect(csv).toContain('3,0,1,SADD R3 R3 RCL');
  });

  it('supports column normalization with explicit upward direction', () => {
    const source = `
target "uma-cgra-base";
build {
  grid 3x5 mesh;
}
kernel "feat5_col" {
  normalize(reg=R2, carry=R0, width=8, mask=255, axis=col, lane=1, dir=up);
}
`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    const lines = csvRows(csv);
    expect(lines).toHaveLength(12);
    expect(csv).toContain('0,2,1,SRT R0 R2 8');
    expect(csv).toContain('3,2,1,SADD R2 R2 ZERO');
    expect(csv).toContain('3,1,1,SADD R2 R2 RCB');
  });

  it('emits parse diagnostics for malformed normalize syntax', () => {
    const malformed = compile(`
target "uma-cgra-base";
kernel "feat5_bad_parse" {
  normalize(reg=R3, carry=R1, width=16);
}
`);

    expect(malformed.success).toBe(false);
    expect(malformed.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('emits semantic diagnostics for invalid normalize geometry', () => {
    const wrongDirection = compile(`
target "uma-cgra-base";
kernel "feat5_bad_dir" {
  normalize(reg=R3, carry=R1, width=16, lane=0, axis=row, dir=up);
}
`);
    expect(wrongDirection.success).toBe(false);
    expect(wrongDirection.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const badLane = compile(`
target "uma-cgra-base";
kernel "feat5_bad_lane" {
  normalize(reg=R3, carry=R1, width=16, lane=9, axis=row, dir=right);
}
`);
    expect(badLane.success).toBe(false);
    expect(badLane.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badWidth = compile(`
target "uma-cgra-base";
kernel "feat5_bad_width" {
  normalize(reg=R3, carry=R1, width=31, lane=0);
}
`);
    expect(badWidth.success).toBe(false);
    expect(badWidth.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
