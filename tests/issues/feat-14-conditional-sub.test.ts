import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-14 conditional_sub statement', () => {
  it('lowers all-target conditional subtraction into deterministic two-cycle sequence', () => {
    const source = `
target "uma-cgra-base";
kernel "feat14_all" {
  conditional_sub(value=R0, sub=R1, dest=R2);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    const rows = csvRows(csv);
    expect(rows).toHaveLength(32);
    expect(csv).toContain('0,0,0,SSUB R2 R0 R1');
    expect(csv).toContain('0,3,3,SSUB R2 R0 R1');
    expect(csv).toContain('1,0,0,BSFA R2 R0 R2 SELF');
    expect(csv).toContain('1,3,3,BSFA R2 R0 R2 SELF');
  });

  it('supports row/point targets for localized conditional subtraction', () => {
    const rowResult = compile(`
target "uma-cgra-base";
build {
  grid 3x5 mesh;
}
kernel "feat14_row" {
  conditional_sub(value=R4, sub=R5, dest=R6, target=row(1));
}
`);
    expect(rowResult.success).toBe(true);
    const rowCsv = rowResult.artifacts.csv ?? '';
    expect(csvRows(rowCsv)).toHaveLength(10);
    expect(rowCsv).toContain('0,1,0,SSUB R6 R4 R5');
    expect(rowCsv).toContain('1,1,4,BSFA R6 R4 R6 SELF');
    expect(rowCsv).not.toContain('0,0,0,SSUB R6 R4 R5');

    const pointResult = compile(`
target "uma-cgra-base";
build {
  grid 3x5 mesh;
}
kernel "feat14_point" {
  conditional_sub(value=R7, sub=R1, dest=R0, target=point(1,2));
}
`);
    expect(pointResult.success).toBe(true);
    const pointCsv = pointResult.artifacts.csv ?? '';
    expect(csvRows(pointCsv)).toHaveLength(2);
    expect(pointCsv).toContain('0,1,2,SSUB R0 R7 R1');
    expect(pointCsv).toContain('1,1,2,BSFA R0 R7 R0 SELF');
  });

  it('emits explicit diagnostics for malformed and out-of-bounds targets', () => {
    const malformed = compile(`
target "uma-cgra-base";
kernel "feat14_bad_parse" {
  conditional_sub(value=R0, sub=R1);
}
`);
    expect(malformed.success).toBe(false);
    expect(malformed.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const invalidTarget = compile(`
target "uma-cgra-base";
kernel "feat14_bad_target" {
  conditional_sub(value=R0, sub=R1, dest=R2, target=diag(1));
}
`);
    expect(invalidTarget.success).toBe(false);
    expect(invalidTarget.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const oobTarget = compile(`
target "uma-cgra-base";
kernel "feat14_oob" {
  conditional_sub(value=R0, sub=R1, dest=R2, target=col(99));
}
`);
    expect(oobTarget.success).toBe(false);
    expect(oobTarget.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });
});
