import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvData(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-17 guard condition statement', () => {
  it('filters placements with spatial predicate col>=row', () => {
    const source = `
target "uma-cgra-base";
kernel "feat17_upper" {
  guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    const lines = csvData(csv);
    expect(lines).toHaveLength(10);
    expect(csv).toContain('0,0,0,SMUL R2 R0 R1');
    expect(csv).toContain('0,3,3,SMUL R2 R0 R1');
    expect(csv).not.toContain('0,1,0,SMUL R2 R0 R1');
  });

  it('supports arithmetic predicates over idx/rows/cols', () => {
    const source = `
target "uma-cgra-base";
kernel "feat17_idx" {
  guard(cond=(idx%2)==0, op=SADD, dest=R3, srcA=R0, srcB=ZERO);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const lines = csvData(result.artifacts.csv ?? '');
    expect(lines).toHaveLength(8);
    expect(lines).toContain('0,0,0,SADD R3 R0 ZERO');
    expect(lines).toContain('0,0,2,SADD R3 R0 ZERO');
    expect(lines).toContain('0,1,0,SADD R3 R0 ZERO');
    expect(lines).not.toContain('0,0,1,SADD R3 R0 ZERO');
  });

  it('supports truthy predicates without an explicit comparator', () => {
    const source = `
target "uma-cgra-base";
kernel "feat17_truthy" {
  guard(cond=idx%2, op=SADD, dest=R3, srcA=R0, srcB=ZERO);
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    const lines = csvData(result.artifacts.csv ?? '');
    expect(lines).toHaveLength(8);
  });

  it('respects NxM grid shape in guard evaluation', () => {
    const source = `
target "uma-cgra-base";
build {
  grid 3x5 mesh;
}
kernel "feat17_nxm" {
  guard(cond=row<2, op=SADD, dest=R0, srcA=ZERO, srcB=ZERO);
}
`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const lines = csvData(result.artifacts.csv ?? '');
    expect(lines).toHaveLength(10);
    expect(lines).toContain('0,1,4,SADD R0 ZERO ZERO');
    expect(lines).not.toContain('0,2,0,SADD R0 ZERO ZERO');
  });

  it('emits diagnostics for malformed guard syntax or unevaluable conditions', () => {
    const malformed = compile(`
target "uma-cgra-base";
kernel "feat17_bad" {
  guard(cond=col>=row, op=SADD);
}
`);
    expect(malformed.success).toBe(false);
    expect(malformed.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const invalidCondition = compile(`
target "uma-cgra-base";
kernel "feat17_bad_cond" {
  guard(cond=foo>=row, op=SADD, dest=R1, srcA=R0, srcB=ZERO);
}
`);
    expect(invalidCondition.success).toBe(false);
    expect(invalidCondition.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const brokenCondition = compile(`
target "uma-cgra-base";
kernel "feat17_broken_cond" {
  guard(cond=col>=, op=SADD, dest=R1, srcA=R0, srcB=ZERO);
}
`);
    expect(brokenCondition.success).toBe(false);
    expect(brokenCondition.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const invalidExpression = compile(`
target "uma-cgra-base";
kernel "feat17_invalid_expr" {
  guard(cond=(row+, op=SADD, dest=R1, srcA=R0, srcB=ZERO);
}
`);
    expect(invalidExpression.success).toBe(false);
    expect(invalidExpression.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
