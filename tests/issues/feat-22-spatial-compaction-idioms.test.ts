import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-22 spatial compaction idioms', () => {
  it('supports one-line full-grid load using at all', () => {
    const source = `
target "uma-cgra-base";

function load_all(reg, addr) {
  bundle {
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
    const loadRows = rows.filter((line) => line.endsWith(',LWI R0 360'));
    expect(loadRows).toHaveLength(16);
    expect(loadRows.every((line) => /,\d+,\d+,LWI R0 360$/.test(line))).toBe(true);
  });

  it('supports compact qhat preload with range coordinates + loop variable', () => {
    const source = `
target "uma-cgra-base";
let L = { 10, 20, 30, 40, 50, 60 };

function compute_qhat_inregs() {
  bundle {
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
    const qhatRows = rows.filter((line) => /,LWI R0 (4|8|12|16)$/.test(line));
    expect(qhatRows).toHaveLength(12);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toMatch(/\n\d+,0,0,LWI R0 4(?:\n|$)/);
    expect(csv).toMatch(/\n\d+,0,1,LWI R0 8(?:\n|$)/);
    expect(csv).toMatch(/\n\d+,0,2,LWI R0 12(?:\n|$)/);
    expect(csv).toMatch(/\n\d+,0,3,LWI R0 16(?:\n|$)/);
    expect(csv).toMatch(/\n\d+,2,3,LWI R0 16(?:\n|$)/);
  });
});
