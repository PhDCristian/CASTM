import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';

describe('issues/FEAT-3 specialize pass', () => {
  it('specializes SMUL identities with 1 and 0', () => {
    const source = `
target "uma-cgra-base";
kernel "feat3_smul" {
  cycle {
    @0,0: SMUL R2, R0, IMM(1);
    @0,1: SMUL R3, IMM(1), R1;
    @0,2: SMUL R4, R1, IMM(0);
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R2 R0 ZERO');
    expect(csv).toContain('0,0,1,SADD R3 R1 ZERO');
    expect(csv).toContain('0,0,2,SADD R4 ZERO ZERO');
  });

  it('specializes additive and shift identities', () => {
    const source = `
target "uma-cgra-base";
kernel "feat3_add_shift" {
  cycle {
    @0,0: SADD R1, R0, IMM(0);
    @0,1: SADD R2, IMM(0), R0;
    @0,2: SSUB R3, R2, IMM(0);
    @0,3: SRT R4, R3, IMM(0);
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(csv).toContain('0,0,1,SADD R2 R0 ZERO');
    expect(csv).toContain('0,0,2,SADD R3 R2 ZERO');
    expect(csv).toContain('0,0,3,SADD R4 R3 ZERO');
  });

  it('specializes logical identities', () => {
    const source = `
target "uma-cgra-base";
kernel "feat3_logic" {
  cycle {
    @0,0: LAND R1, R0, IMM(0);
    @0,1: LOR R2, R0, IMM(0);
    @0,2: LXOR R3, R0, IMM(0);
    @0,3: LXOR R4, R1, R1;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R1 ZERO ZERO');
    expect(csv).toContain('0,0,1,SADD R2 R0 ZERO');
    expect(csv).toContain('0,0,2,SADD R3 R0 ZERO');
    expect(csv).toContain('0,0,3,SADD R4 ZERO ZERO');
  });

  it('keeps non-specializable operations unchanged', () => {
    const source = `
target "uma-cgra-base";
kernel "feat3_keep" {
  cycle {
    @0,0: SMUL R1, R0, FACTOR;
    @0,1: FXPMUL R2, R0, IMM(1);
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SMUL R1 R0 FACTOR');
    expect(csv).toContain('0,0,1,FXPMUL R2 R0 IMM(1)');
  });
});
