import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';

describe('issues/FEAT-9 inline operand arithmetic', () => {
  it('folds arithmetic in IMM(...) operands', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_imm" {
  cycle {
    @0,0: SADD R1, ZERO, IMM((2 + 3) * 4);
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 ZERO IMM(20)');
  });

  it('folds inline arithmetic in explicit LWI/SWI operands', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_lwi_swi" {
  cycle {
    @0,0: LWI R0, 360 + 2*4;
    @0,1: SWI R0, (400 + 8) - 4;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,LWI R0 368');
    expect(csv).toContain('0,0,1,SWI R0 404');
  });

  it('folds arithmetic introduced by memory sugar desugaring', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_memory_sugar" {
  cycle {
    @0,0: R1 = [360 + (2 + 1) * 4];
    @0,1: [400 + (3 * 4)] = R1;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,LWI R1 372');
    expect(csv).toContain('0,0,1,SWI R1 412');
  });

  it('folds arithmetic after compile-time loop binding', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_loop_bound" {
  for i in range(4) {
    cycle {
      @0,i: SRT R1, R0, IMM(i*8);
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SRT R1 R0 IMM(0)');
    expect(csv).toContain('1,0,1,SRT R1 R0 IMM(8)');
    expect(csv).toContain('2,0,2,SRT R1 R0 IMM(16)');
    expect(csv).toContain('3,0,3,SRT R1 R0 IMM(24)');
  });

  it('keeps unresolved symbolic arithmetic untouched', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_symbolic" {
  cycle {
    @0,0: LWI R0, BASE + i*4;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,LWI R0 BASE + i*4');
  });

  it('keeps non-numeric or malformed inline expressions untouched', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_invalid_inline" {
  cycle {
    @0,0: SADD R1, ZERO, IMM(1 < 2);
    @0,1: SADD R2, ZERO, IMM(1 + );
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R1 ZERO IMM(1 < 2)');
    expect(csv).toContain('0,0,1,SADD R2 ZERO IMM(1 + )');
  });
});
