import { describe, it, expect } from 'vitest';
import { compileDslToCsv } from '@utils/dsl-compiler';
import { compileAndSimulate, getRegister } from './helpers/simulation';

describe('for inside cycle {}', () => {
  it('should unroll for-loop instructions into a single cycle', () => {
    const code = `
kernel "ForInCycle" {
  config(0xF, 0);
  cycle {
    for k in range(4) {
      @0,k: SADD R0, ZERO, IMM(k);
    }
  }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, ZERO, 0');
    expect(result.csv).toContain('SADD R0, ZERO, 1');
    expect(result.csv).toContain('SADD R0, ZERO, 2');
    expect(result.csv).toContain('SADD R0, ZERO, 3');

    // One compute cycle + one exit cycle
    const cycleCount = result.csv!.split('\n').filter(l => /^\d+$/.test(l.trim())).length;
    expect(cycleCount).toBe(2);
  });

  it('should report PE conflict when two iterations target same PE', () => {
    const code = `
kernel "ForInCycleConflict" {
  config(0xF, 0);
  cycle {
    for k in range(2) {
      @0,0: SADD R0, ZERO, IMM(k);
    }
  }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(false);
    expect(result.error).toContain('assigned multiple times');
  });

  it('should report PE conflict for row broadcast collisions across iterations', () => {
    const code = `
kernel "ForInCycleRowConflict" {
  config(0xF, 0);
  cycle {
    for r in range(2) {
      row 0: SADD R0, ZERO, IMM(r);
    }
  }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(false);
    expect(result.error).toContain('assigned multiple times');
  });

  it('should report PE conflict for all: collisions across iterations', () => {
    const code = `
kernel "ForInCycleAllConflict" {
  config(0xF, 0);
  cycle {
    for r in range(2) {
      all: SADD R0, ZERO, IMM(r);
    }
  }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(false);
    expect(result.error).toContain('assigned multiple times');
  });
});

describe('C-like expressions with function parameters', () => {
  it('should desugar parameterized destination/source expressions after function expansion', () => {
    const code = `
function extract(dst, src) {
  cycle { @0,0: dst = src >> 16; }
}

kernel "FnParamExpr" {
  config(0xF, 0);
  cycle { @0,0: SADD R0, ZERO, IMM(65536); }
  extract(R1, R0);
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SRT R1, R0, 16');
  });
});

describe('Memory sugar load/store', () => {
  it('should desugar register load from named array', () => {
    const code = `
.data A { 10, 20, 30, 40 }
kernel "LoadSugar" {
  config(0xF, 0);
  cycle { @0,0: R3 = A[1]; }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('LWI R3, 4');
  });

  it('should desugar register store into named array', () => {
    const code = `
.data A { 0, 0, 0, 0 }
kernel "StoreSugar" {
  config(0xF, 0);
  cycle { @0,0: SADD R2, ZERO, IMM(123); }
  cycle { @0,0: A[2] = R2; }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SWI R2, 8');
  });

  it('should desugar raw address load/store with expression', () => {
    const code = `
kernel "RawAddrSugar" {
  config(0xF, 0);
  cycle { @0,0: SADD R1, ZERO, IMM(5); }
  for i in range(2) {
    cycle { @0,0: [360 + i*4] = R1; }
  }
  for i in range(2) {
    cycle { @0,0: R2 = [360 + i*4]; }
  }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SWI R1, 360');
    expect(result.csv).toContain('SWI R1, 364');
    expect(result.csv).toContain('LWI R2, 360');
    expect(result.csv).toContain('LWI R2, 364');
  });

  it('should reject memory-to-memory assignment', () => {
    const code = `
.data A { 1, 2 }
.data B { 3, 4 }
kernel "MemToMem" {
  config(0xF, 0);
  cycle { @0,0: A[0] = B[0]; }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Memory-to-memory assignment');
  });

  it('should reject non-register destination for load assignment', () => {
    const code = `
kernel "LoadDstMustBeReg" {
  config(0xF, 0);
  cycle { @0,0: out = [360]; }
  cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(false);
    expect(result.error).toContain('destination must be a register');
  });
});

describe('Row broadcast mixed with pipe rows', () => {
  it('should keep row broadcast semantics when mixed with pipe-varied rows in same cycle', () => {
    const result = compileAndSimulate(`
.data mu { 11, 22, 33 }
kernel "RowBroadcastMixed" {
  config(0xF, 0);
  cycle {
    row 0: SADD R3, ZERO, IMM(1) | LWI R1, mu[0] | LWI R1, mu[0] | LWI R1, mu[0];
    row 1: LWI R1, mu[1];
  }
  cycle { @0,0: EXIT; }
}
`);

    expect(getRegister(result, 1, 0, 'R1')).toBe(22);
    expect(getRegister(result, 1, 1, 'R1')).toBe(22);
    expect(getRegister(result, 1, 2, 'R1')).toBe(22);
    expect(getRegister(result, 1, 3, 'R1')).toBe(22);
  });
});
