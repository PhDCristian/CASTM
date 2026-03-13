import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('issues/FEAT-3 specialize pass', () => {
  it('specializes SMUL identities with 1 and 0', () => {
    const source = `
target "uma-cgra-base";
kernel "feat3_smul" {
  bundle {
    @0,0: SMUL R2, R0, 1;
    @0,1: SMUL R3, 1, R1;
    @0,2: SMUL R4, R1, 0;
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
  bundle {
    @0,0: SADD R1, R0, 0;
    @0,1: SADD R2, 0, R0;
    @0,2: SSUB R3, R2, 0;
    @0,3: SRT R4, R3, 0;
    @1,0: SRT R5, 0, 2;
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
    expect(csv).toContain('0,1,0,SADD R5 ZERO ZERO');
  });

  it('specializes logical identities', () => {
    const source = `
target "uma-cgra-base";
kernel "feat3_logic" {
  bundle {
    @0,0: LAND R1, R0, 0;
    @0,1: LOR R2, R0, 0;
    @0,2: LXOR R3, R0, 0;
    @0,3: LXOR R4, R1, R1;
    @1,0: LOR R5, 0, R2;
    @1,1: LXOR R6, 0, R2;
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
    expect(csv).toContain('0,1,0,SADD R5 R2 ZERO');
    expect(csv).toContain('0,1,1,SADD R6 R2 ZERO');
  });

  it('keeps non-specializable operations unchanged', () => {
    const source = `
target "uma-cgra-base";
kernel "feat3_keep" {
  bundle {
    @0,0: SMUL R1, R0, FACTOR;
    @0,1: FXPMUL R2, R0, 1;
    @0,2: SSUB R3, R2, 2;
    @0,3: LOR R4, R2, 5;
    @1,0: LXOR R5, R1, R2;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SMUL R1 R0 FACTOR');
    expect(csv).toContain('0,0,1,FXPMUL R2 R0 1');
    expect(csv).toContain('0,0,2,SSUB R3 R2 2');
    expect(csv).toContain('0,0,3,LOR R4 R2 5');
    expect(csv).toContain('0,1,0,LXOR R5 R1 R2');
  });

  it('specializes identities when immediates are written as IMM(...)', () => {
    const source = `
target "uma-cgra-base";
kernel "feat3_imm_wrapped" {
  bundle {
    @0,0: SADD R1, R0, IMM(0);
    @0,1: SMUL R2, R0, IMM(1);
    @0,2: LAND R3, R0, IMM(0);
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(csv).toContain('0,0,1,SADD R2 R0 ZERO');
    expect(csv).toContain('0,0,2,SADD R3 ZERO ZERO');
  });
});
