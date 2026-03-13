import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/OPT-A cycle packing', () => {
  it('packs independent single-PE cycles into fewer cycles', () => {
    const source = `
target "uma-cgra-base";
kernel "opt_a_pack" {
  latency_hide(window=2, mode=conservative);
  bundle { @0,0: SADD R1, R0, ZERO; }
  bundle { @0,2: SADD R1, R0, ZERO; }
  bundle { @0,3: SADD R1, R0, ZERO; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows).toHaveLength(3);
    expect(rows.every((line) => line.startsWith('0,'))).toBe(true);
    expect(rows).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(rows).toContain('0,0,2,SADD R1 R0 ZERO');
    expect(rows).toContain('0,0,3,SADD R1 R0 ZERO');
  });

  it('keeps route-dependent cycles unmerged as a safety guard', () => {
    const source = `
target "uma-cgra-base";
kernel "opt_a_route_guard" {
  latency_hide(window=2, mode=conservative);
  bundle { @0,0: SADD ROUT, R1, ZERO; }
  bundle { @0,1: SADD R2, RCL, ZERO; }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows).toContain('0,0,0,SADD ROUT R1 ZERO');
    expect(rows).toContain('1,0,1,SADD R2 RCL ZERO');
  });
});
