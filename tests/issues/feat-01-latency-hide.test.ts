import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-1 latency_hide statement', () => {
  it('compacts independent adjacent cycles into a single cycle index', () => {
    const source = `
target "uma-cgra-base";
kernel "feat01_latency_hide" {
  latency_hide(window=1, mode=conservative);
  bundle { at row 1: SMUL R2, R0, R1; }
  bundle { @0,3: LWI R1, 4; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows.some((line) => line === '0,0,3,LWI R1 4')).toBe(true);
    expect(rows.every((line) => line.startsWith('0,'))).toBe(true);
  });

  it('keeps route-dependent cycles in separate cycle indices', () => {
    const source = `
target "uma-cgra-base";
kernel "feat01_latency_dependency" {
  latency_hide(window=1, mode=conservative);
  bundle { @0,0: SADD ROUT, R1, ZERO; }
  bundle { @0,1: SADD R2, RCL, ZERO; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows.some((line) => line === '0,0,0,SADD ROUT R1 ZERO')).toBe(true);
    expect(rows.some((line) => line === '1,0,1,SADD R2 RCL ZERO')).toBe(true);
  });

  it('rejects malformed latency_hide options', () => {
    const source = `
target "uma-cgra-base";
kernel "feat01_latency_invalid" {
  latency_hide(mode=aggressive);
  bundle { @0,0: NOP; }
}
`;
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diag) => diag.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
