import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-15 row auto-broadcast', () => {
  it('expands a single at-row instruction to every column in that row', () => {
    const source = `
target "uma-cgra-base";
kernel "feat15_row" {
  bundle {
    at row 1: SADD R3, ZERO, ZERO;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const lines = csvRows(result.artifacts.csv ?? '');
    expect(lines).toHaveLength(4);
    expect(lines).toContain('0,1,0,SADD R3 ZERO ZERO');
    expect(lines).toContain('0,1,1,SADD R3 ZERO ZERO');
    expect(lines).toContain('0,1,2,SADD R3 ZERO ZERO');
    expect(lines).toContain('0,1,3,SADD R3 ZERO ZERO');
  });

  it('uses current grid columns for row auto-broadcast in NxM mode', () => {
    const source = `
target "uma-cgra-base";
build {
  optimize O0;
  prune_noop_cycles off;
  grid 3x6 mesh;
}
kernel "feat15_row_nxm" {
  bundle {
    at row 0: NOP;
  }
}
`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const lines = csvRows(result.artifacts.csv ?? '');
    expect(lines).toHaveLength(6);
    expect(lines).toContain('0,0,0,NOP');
    expect(lines).toContain('0,0,5,NOP');
  });

  it('keeps explicit row segments and fills remaining columns with NOP', () => {
    const source = `
target "uma-cgra-base";
kernel "feat15_row_segments" {
  bundle {
    at row 0: SADD R1, ZERO, ZERO | SMUL R2, R0, R1;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R1 ZERO ZERO');
    expect(csv).toContain('0,0,1,SMUL R2 R0 R1');
    expect(csv).toContain('0,0,2,NOP');
    expect(csv).toContain('0,0,3,NOP');
  });

  it('rejects legacy row namespace without canonical at-prefix', () => {
    const source = `
target "uma-cgra-base";
kernel "feat15_legacy_row" {
  bundle {
    row 0: NOP;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diag) => diag.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
