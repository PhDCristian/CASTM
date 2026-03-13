import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('issues/FEAT-9 inline operand arithmetic', () => {
  const hasInstructionAt = (csv: string, row: number, col: number, text: string): boolean => {
    const normalized = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\n\\d+,${row},${col},${normalized}(?:\\n|$)`).test(csv);
  };

  it('folds arithmetic in immediate operands', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_inline" {
  bundle {
    @0,0: SADD R1, ZERO, (2 + 3) * 4;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 ZERO 20');
  });

  it('folds inline arithmetic in explicit LWI/SWI operands', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_lwi_swi" {
  bundle {
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
  bundle {
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
    bundle {
      @0,i: SRT R1, R0, i*8;
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(hasInstructionAt(csv, 0, 0, 'SADD R1 R0 ZERO')).toBe(true);
    expect(hasInstructionAt(csv, 0, 1, 'SRT R1 R0 8')).toBe(true);
    expect(hasInstructionAt(csv, 0, 2, 'SRT R1 R0 16')).toBe(true);
    expect(hasInstructionAt(csv, 0, 3, 'SRT R1 R0 24')).toBe(true);
  });

  it('keeps unresolved symbolic arithmetic untouched', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_symbolic" {
  bundle {
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
  bundle {
    @0,0: SADD R1, ZERO, 1 < 2;
    @0,1: SADD R2, ZERO, 1 +;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R1 ZERO 1 < 2');
    expect(csv).toContain('0,0,1,SADD R2 ZERO 1 +');
  });

  it('keeps malformed IMM(...) inline arithmetic untouched', () => {
    const source = `
target "uma-cgra-base";
kernel "feat9_invalid_imm_inline" {
  bundle {
    @0,0: SADD R1, ZERO, IMM(1 +);
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R1 ZERO 1 +');
  });
});
