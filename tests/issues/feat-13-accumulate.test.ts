import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-13 accumulate statement', () => {
  it('lowers anti_diagonal accumulation into deterministic staged cycles', () => {
    const source = `
target "uma-cgra-base";
kernel "feat13_antidiag" {
  accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    const rows = csvRows(csv);
    expect(rows).toHaveLength(64);
    expect(csv).toContain('0,0,0,SADD R3 R2 ZERO');
    expect(csv).toContain('1,0,3,SADD R3 R3 ZERO');
    expect(csv).toContain('1,1,2,SADD R3 R3 RCT');
    expect(csv).toContain('2,0,2,SADD R3 R3 RCR');
    expect(csv).toContain('3,3,3,SADD ROUT R3 ZERO');
  });

  it('supports row and column accumulation modes on NxM grids', () => {
    const rowResult = compile(`
target "uma-cgra-base";
build {
  grid 2x3 mesh;
}
kernel "feat13_row" {
  accumulate(pattern=row, products=R1, accum=R4, out=R5, combine=xor);
}
`);
    expect(rowResult.success).toBe(true);
    const rowCsv = rowResult.artifacts.csv ?? '';
    expect(csvRows(rowCsv)).toHaveLength(18);
    expect(rowCsv).toContain('1,0,1,LXOR R4 R4 RCL');
    expect(rowCsv).toContain('2,1,2,SADD R5 R4 ZERO');

    const colResult = compile(`
target "uma-cgra-base";
build {
  grid 3x2 mesh;
}
kernel "feat13_col" {
  accumulate(pattern=col, products=R1, accum=R4, out=R5, combine=sub);
}
`);
    expect(colResult.success).toBe(true);
    const colCsv = colResult.artifacts.csv ?? '';
    expect(csvRows(colCsv)).toHaveLength(18);
    expect(colCsv).toContain('1,1,0,SSUB R4 R4 RCT');
    expect(colCsv).toContain('2,2,1,SADD R5 R4 ZERO');
  });

  it('supports explicit steps and validates step limits against grid shape', () => {
    const stepped = compile(`
target "uma-cgra-base";
build {
  grid 2x3 mesh;
}
kernel "feat13_steps" {
  accumulate(pattern=row, products=R1, accum=R4, out=R5, combine=xor, steps=2);
}
`);
    expect(stepped.success).toBe(true);
    expect(stepped.artifacts.mir?.cycles).toHaveLength(4);

    const tooDeep = compile(`
target "uma-cgra-base";
build {
  grid 2x3 mesh;
}
kernel "feat13_too_deep" {
  accumulate(pattern=row, products=R1, accum=R4, out=R5, steps=8);
}
`);
    expect(tooDeep.success).toBe(false);
    expect(tooDeep.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('supports scoped accumulation on a single row/column and rejects incompatible scope-pattern combinations', () => {
    const scopedRow = compile(`
target "uma-cgra-base";
kernel "feat13_scope_row" {
  accumulate(pattern=row, products=R1, accum=R4, out=R5, scope=row(1));
}
`);
    expect(scopedRow.success).toBe(true);
    const scopedRowCsv = scopedRow.artifacts.csv ?? '';
    expect(scopedRowCsv).toContain('0,1,0,SADD R4 R1 ZERO');
    expect(scopedRowCsv).not.toContain('0,0,0,SADD R4 R1 ZERO');

    const scopedCol = compile(`
target "uma-cgra-base";
kernel "feat13_scope_col" {
  accumulate(pattern=col, products=R1, accum=R4, out=R5, scope=col(2));
}
`);
    expect(scopedCol.success).toBe(true);
    const scopedColCsv = scopedCol.artifacts.csv ?? '';
    expect(scopedColCsv).toContain('0,0,2,SADD R4 R1 ZERO');
    expect(scopedColCsv).not.toContain('0,0,1,SADD R4 R1 ZERO');

    const incompatible = compile(`
target "uma-cgra-base";
kernel "feat13_scope_mismatch" {
  accumulate(pattern=anti_diagonal, products=R1, accum=R4, out=R5, scope=row(1));
}
`);
    expect(incompatible.success).toBe(false);
    expect(incompatible.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('skips redundant seed/final stages when products, accum and out share register', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "feat13_compact" {
  accumulate(pattern=row, products=R3, accum=R3, out=R3, combine=xor);
}
`);
    expect(result.success).toBe(true);
    expect(result.artifacts.mir?.cycles).toHaveLength(1);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,1,LXOR R3 R3 RCL');
    expect(csv).not.toContain('SADD R3 R3 ZERO');
  });

  it('rejects malformed or unsupported accumulate forms', () => {
    const badPattern = compile(`
target "uma-cgra-base";
kernel "feat13_bad_pattern" {
  accumulate(pattern=diag, products=R2, accum=R3, out=ROUT);
}
`);
    expect(badPattern.success).toBe(false);
    expect(badPattern.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const missingFields = compile(`
target "uma-cgra-base";
kernel "feat13_missing" {
  accumulate(pattern=row, products=R2, out=ROUT);
}
`);
    expect(missingFields.success).toBe(false);
    expect(missingFields.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
