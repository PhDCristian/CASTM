import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-22 spatial compaction idioms', () => {
  it('supports one-line full-grid load using at all', () => {
    const source = `
target "uma-cgra-base";

function load_all(reg, addr) {
  cycle {
    at all: LWI reg, addr;
  }
}

kernel "load_all_compact" {
  load_all(R0, 360);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows).toHaveLength(16);
    expect(rows.every((line) => line.startsWith('0,'))).toBe(true);
    expect(rows.every((line) => line.endsWith(',LWI R0 360'))).toBe(true);
  });

  it('supports compact qhat preload with range coordinates + loop variable', () => {
    const source = `
target "uma-cgra-base";
let L = { 10, 20, 30, 40, 50, 60 };

function compute_qhat_inregs() {
  cycle {
    for c in range(0, 4) {
      at @0..2,c: R0 = L[c+1];
    }
  }
}

kernel "qhat_compact" {
  compute_qhat_inregs();
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows).toHaveLength(12);
    expect(rows.every((line) => line.startsWith('0,'))).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,LWI R0 4');
    expect(csv).toContain('0,0,1,LWI R0 8');
    expect(csv).toContain('0,0,2,LWI R0 12');
    expect(csv).toContain('0,0,3,LWI R0 16');
    expect(csv).toContain('0,2,3,LWI R0 16');
  });
});
