import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-10 stash statement', () => {
  it('lowers point-target save/restore to SWI/LWI at explicit coordinate', () => {
    const source = `
target "uma-cgra-base";
let L @360 = { 0, 0, 0, 0 };
kernel "feat10_stash_point" {
  stash(action=save, reg=R0, addr=L[0], target=point(3,0));
  stash(action=restore, reg=R1, addr=L[0], target=point(3,0));
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows).toContain('0,3,0,SWI R0 L[0]');
    expect(rows).toContain('1,3,0,LWI R1 L[0]');
  });

  it('supports row/col/all spatial targets', () => {
    const row = compile(`
target "uma-cgra-base";
let L @100 = { 0, 0, 0, 0 };
kernel "feat10_row" {
  stash(action=save, reg=R2, addr=L[0], target=row(1));
}
`);
    expect(row.success).toBe(true);
    const rowLines = csvRows(row.artifacts.csv ?? '');
    expect(rowLines.filter((line) => line.startsWith('0,1,')).length).toBe(4);

    const col = compile(`
target "uma-cgra-base";
let L @100 = { 0, 0, 0, 0 };
kernel "feat10_col" {
  stash(action=restore, reg=R3, addr=L[0], target=col(2));
}
`);
    expect(col.success).toBe(true);
    const colLines = csvRows(col.artifacts.csv ?? '');
    expect(colLines.filter((line) => line.includes(',2,')).length).toBe(4);

    const all = compile(`
target "uma-cgra-base";
let L @100 = { 0, 0, 0, 0 };
kernel "feat10_all" {
  stash(action=save, reg=R4, addr=L[0], target=all);
}
`);
    expect(all.success).toBe(true);
    expect(csvRows(all.artifacts.csv ?? '')).toHaveLength(16);
  });

  it('rejects out-of-bounds stash targets', () => {
    const source = `
target "uma-cgra-base";
let L @360 = { 0, 0, 0, 0 };
kernel "feat10_oob" {
  stash(action=save, reg=R0, addr=L[0], target=point(9,0));
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diag) => diag.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('rejects malformed stash syntax', () => {
    const source = `
target "uma-cgra-base";
let L @360 = { 0, 0, 0, 0 };
kernel "feat10_bad" {
  stash(action=invalid, reg=R0, addr=L[0]);
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diag) => diag.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('accepts raw numeric addresses in addr=', () => {
    const source = `
target "uma-cgra-base";
kernel "feat10_raw_addr" {
  stash(action=save, reg=R0, addr=360, target=point(0,0));
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows).toContain('0,0,0,SWI R0 360');
  });
});
