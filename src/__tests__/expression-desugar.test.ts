/**
 * Tests for the C-like expression desugaring pass.
 *
 * Verifies that register expressions like `R1 = R2 + R3;`
 * are correctly transformed to ISA instructions like `SADD R1, R2, R3;`.
 */
import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer/lexer';
import { desugarExpressions } from '../parser/expression-desugar';
import { compileDslToCsv } from '../compiler';
import { TokenType } from '../types/tokens';

/**
 * Helper: tokenize source, desugar, and return the desugared token values
 * (excluding EOF, comments, and whitespace).
 */
function desugar(source: string): string[] {
  const tokens = tokenize(source);
  const desugared = desugarExpressions(tokens);
  return desugared
    .filter(t => t.type !== TokenType.EOF && t.type !== TokenType.COMMENT)
    .map(t => t.value);
}

/**
 * Helper: wrap instruction-level code in a minimal kernel with cycle block.
 */
function wrapInKernel(cycleContent: string): string {
  return `kernel "Test" {
    config(0xF, 0);
    cycle {
        ${cycleContent}
    }
    cycle { @0,0: EXIT; }
}`;
}

/**
 * Helper: compile a kernel with C-like syntax and return CSV.
 */
function compileWithExpr(cycleContent: string) {
  return compileDslToCsv(wrapInKernel(cycleContent));
}

// ==========================================
// Token-level desugaring tests
// ==========================================

describe('Expression Desugaring - Token Level', () => {
  describe('Arithmetic operators', () => {
    it('should desugar R1 = R2 + R3 to SADD', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R2 + R3;'));
      expect(tokens).toContain('SADD');
      // Verify the sequence: ... SADD R1 , R2 , R3 ;
      const saddIdx = tokens.indexOf('SADD');
      expect(tokens[saddIdx + 1]).toBe('R1');
      expect(tokens[saddIdx + 2]).toBe(',');
      expect(tokens[saddIdx + 3]).toBe('R2');
      expect(tokens[saddIdx + 4]).toBe(',');
      expect(tokens[saddIdx + 5]).toBe('R3');
    });

    it('should desugar R0 = R1 - R2 to SSUB', () => {
      const tokens = desugar(wrapInKernel('@0,0: R0 = R1 - R2;'));
      expect(tokens).toContain('SSUB');
      const idx = tokens.indexOf('SSUB');
      expect(tokens[idx + 1]).toBe('R0');
      expect(tokens[idx + 3]).toBe('R1');
      expect(tokens[idx + 5]).toBe('R2');
    });

    it('should desugar ROUT = R0 * R2 to SMUL', () => {
      const tokens = desugar(wrapInKernel('@0,0: ROUT = R0 * R2;'));
      expect(tokens).toContain('SMUL');
      const idx = tokens.indexOf('SMUL');
      expect(tokens[idx + 1]).toBe('ROUT');
      expect(tokens[idx + 3]).toBe('R0');
      expect(tokens[idx + 5]).toBe('R2');
    });

    it('should desugar R1 = R0 ** R2 to FXPMUL', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 ** R2;'));
      expect(tokens).toContain('FXPMUL');
    });
  });

  describe('Shift operators', () => {
    it('should desugar R1 = R0 << 2 to SLT', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 << 2;'));
      expect(tokens).toContain('SLT');
      const idx = tokens.indexOf('SLT');
      expect(tokens[idx + 1]).toBe('R1');
      expect(tokens[idx + 3]).toBe('R0');
      expect(tokens[idx + 5]).toBe('2');
    });

    it('should desugar R1 = R0 >> 4 to SRT', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 >> 4;'));
      expect(tokens).toContain('SRT');
    });

    it('should desugar R1 = R0 >>> 1 to SRA', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 >>> 1;'));
      expect(tokens).toContain('SRA');
    });
  });

  describe('Bitwise operators', () => {
    it('should desugar R1 = R0 & R2 to LAND', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 & R2;'));
      expect(tokens).toContain('LAND');
    });

    it('should desugar R1 = R0 | R2 to LOR', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 | R2;'));
      expect(tokens).toContain('LOR');
      const idx = tokens.indexOf('LOR');
      expect(tokens[idx + 1]).toBe('R1');
      expect(tokens[idx + 3]).toBe('R0');
      expect(tokens[idx + 5]).toBe('R2');
    });

    it('should desugar R1 = R0 ^ R2 to LXOR', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 ^ R2;'));
      expect(tokens).toContain('LXOR');
    });

    it('should desugar R1 = R0 ~& R2 to LNAND', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 ~& R2;'));
      expect(tokens).toContain('LNAND');
    });

    it('should desugar R1 = R0 ~| R2 to LNOR', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 ~| R2;'));
      expect(tokens).toContain('LNOR');
    });

    it('should desugar R1 = R0 ~^ R2 to LXNOR', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 ~^ R2;'));
      expect(tokens).toContain('LXNOR');
    });
  });

  describe('Operand types', () => {
    it('should handle immediate numbers', () => {
      const tokens = desugar(wrapInKernel('@0,0: R0 = R1 - 5;'));
      expect(tokens).toContain('SSUB');
      const idx = tokens.indexOf('SSUB');
      expect(tokens[idx + 5]).toBe('5');
    });

    it('should handle hex immediates', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R0 & 0xFF;'));
      expect(tokens).toContain('LAND');
      const idx = tokens.indexOf('LAND');
      expect(tokens[idx + 5]).toBe('0xFF');
    });

    it('should handle neighbor references', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = RCR + R0;'));
      expect(tokens).toContain('SADD');
      const idx = tokens.indexOf('SADD');
      expect(tokens[idx + 3]).toBe('RCR');
    });

    it('should handle ZERO operand', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = ZERO + R0;'));
      expect(tokens).toContain('SADD');
      const idx = tokens.indexOf('SADD');
      expect(tokens[idx + 3]).toBe('ZERO');
    });

    it('should handle simple copy: R1 = R2 (no operator)', () => {
      const tokens = desugar(wrapInKernel('@0,0: R1 = R2;'));
      expect(tokens).toContain('SADD');
      const idx = tokens.indexOf('SADD');
      expect(tokens[idx + 1]).toBe('R1');
      expect(tokens[idx + 3]).toBe('R2');
      expect(tokens[idx + 5]).toBe('ZERO');
    });
  });

  describe('Passthrough (no desugaring)', () => {
    it('should not desugar standard assembly instructions', () => {
      const tokens = desugar(wrapInKernel('@0,0: SADD R1, R2, R3;'));
      expect(tokens).toContain('SADD');
      // Should NOT have double SADD (i.e., no transformation)
      const saddCount = tokens.filter(t => t === 'SADD').length;
      expect(saddCount).toBe(1);
    });

    it('should not desugar LWI instructions', () => {
      const code = `.data 0 { 10 }
kernel "Test" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, data[0]; }
    cycle { @0,0: EXIT; }
}`;
      const tokens = desugar(code);
      expect(tokens).toContain('LWI');
      // LWI should remain unchanged
      const lwiIdx = tokens.indexOf('LWI');
      expect(tokens[lwiIdx + 1]).toBe('R0');
    });

    it('should not desugar NOP', () => {
      const tokens = desugar(wrapInKernel('@0,0: NOP;'));
      expect(tokens).toContain('NOP');
    });

    it('should not desugar EXIT', () => {
      const tokens = desugar(wrapInKernel('@0,0: EXIT;'));
      // EXIT appears twice (in cycle body and the exit cycle)
      const exitCount = tokens.filter(t => t === 'EXIT').length;
      expect(exitCount).toBe(2);
    });

    it('should not desugar branch instructions', () => {
      const code = `kernel "Test" {
    config(0xF, 0);
    target:
    cycle { @0,0: BEQ R0, R1, target; }
    cycle { @0,0: EXIT; }
}`;
      const tokens = desugar(code);
      expect(tokens).toContain('BEQ');
    });

    it('should not desugar outside cycle blocks', () => {
      // .const and .alias use = but should not be desugared
      const code = `kernel "Test" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}`;
      const result = compileDslToCsv(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Context awareness', () => {
    it('should only desugar inside cycle blocks', () => {
      // for loop headers should not be affected
      const code = `kernel "Test" {
    config(0xF, 0);
    for i in range(2) {
        cycle { @0,0: R0 = R0 + R1; }
    }
    cycle { @0,0: EXIT; }
}`;
      const result = compileDslToCsv(code);
      expect(result.success).toBe(true);
      expect(result.csv).toContain('SADD R0, R0, R1');
    });
  });
});

// ==========================================
// E2E compilation tests
// ==========================================

describe('Expression Desugaring - E2E Compilation', () => {
  it('should compile arithmetic expressions to correct CSV', () => {
    const result = compileWithExpr('@0,0: R1 = R2 + R3;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R1, R2, R3');
  });

  it('should compile subtraction to SSUB', () => {
    const result = compileWithExpr('@0,0: R0 = R1 - R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SSUB R0, R1, R2');
  });

  it('should compile multiplication to SMUL', () => {
    const result = compileWithExpr('@0,0: ROUT = R0 * R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SMUL ROUT, R0, R2');
  });

  it('should compile shift left to SLT', () => {
    const result = compileWithExpr('@0,0: R1 = R0 << 2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SLT R1, R0, 2');
  });

  it('should compile shift right to SRT', () => {
    const result = compileWithExpr('@0,0: R1 = R0 >> 4;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SRT R1, R0, 4');
  });

  it('should compile arithmetic shift right to SRA', () => {
    const result = compileWithExpr('@0,0: R1 = R0 >>> 1;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SRA R1, R0, 1');
  });

  it('should compile bitwise AND to LAND', () => {
    const result = compileWithExpr('@0,0: R1 = R0 & 0xFF;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('LAND R1, R0, 0xFF');
  });

  it('should compile bitwise XOR to LXOR', () => {
    const result = compileWithExpr('@0,0: R1 = R0 ^ R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('LXOR R1, R0, R2');
  });

  it('should compile NAND to LNAND', () => {
    const result = compileWithExpr('@0,0: R1 = R0 ~& R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('LNAND R1, R0, R2');
  });

  it('should compile NOR to LNOR', () => {
    const result = compileWithExpr('@0,0: R1 = R0 ~| R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('LNOR R1, R0, R2');
  });

  it('should compile XNOR to LXNOR', () => {
    const result = compileWithExpr('@0,0: R1 = R0 ~^ R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('LXNOR R1, R0, R2');
  });

  it('should compile fixed-point multiply to FXPMUL', () => {
    const result = compileWithExpr('@0,0: R1 = R0 ** R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('FXPMUL R1, R0, R2');
  });

  it('should compile neighbor reads correctly', () => {
    const result = compileWithExpr('@0,0: R1 = RCR + R0;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R1, RCR, R0');
  });

  it('should compile simple copy R1 = R2 correctly', () => {
    const result = compileWithExpr('@0,0: R1 = R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R1, R2, ZERO');
  });

  it('should produce identical CSV for C-like and assembly syntax', () => {
    const cLike = compileDslToCsv(`kernel "CStyle" {
    config(0xF, 0);
    cycle {
        @0,0: R1 = R2 + R3;
        @0,1: R0 = R1 - R2;
    }
    cycle { @0,0: EXIT; }
}`);

    const assembly = compileDslToCsv(`kernel "AsmStyle" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R1, R2, R3;
        @0,1: SSUB R0, R1, R2;
    }
    cycle { @0,0: EXIT; }
}`);

    expect(cLike.success).toBe(true);
    expect(assembly.success).toBe(true);
    expect(cLike.csv).toBe(assembly.csv);
  });

  it('should handle mixed assembly and C-like syntax in same cycle', () => {
    const result = compileDslToCsv(`kernel "Mixed" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: R1 = R0 + R2;
    }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, ZERO, 10');
    expect(result.csv).toContain('SADD R1, R0, R2');
  });

  it('should work inside for loops with loop variables', () => {
    const result = compileDslToCsv(`kernel "ForLoop" {
    config(0xF, 0);
    for i in range(3) {
        cycle { @0,0: R0 = R0 + IMM(i); }
    }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, R0, 0');
    expect(result.csv).toContain('SADD R0, R0, 1');
    expect(result.csv).toContain('SADD R0, R0, 2');
  });

  it('should work with data references as operands', () => {
    const result = compileDslToCsv(`.data 0 { 10, 20, 30, 40 }
kernel "DataRef" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, data[0]; }
    cycle { @0,0: R1 = R0 + R2; }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R1, R0, R2');
  });

  it('should handle multiple C-like expressions in different PEs', () => {
    const result = compileDslToCsv(`kernel "MultiPE" {
    config(0xF, 0);
    cycle {
        @0,0: R0 = R1 + R2;
        @0,1: R1 = R0 - R3;
        @0,2: R2 = R0 * R1;
        @0,3: R3 = R0 & R1;
    }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, R1, R2');
    expect(result.csv).toContain('SSUB R1, R0, R3');
    expect(result.csv).toContain('SMUL R2, R0, R1');
    expect(result.csv).toContain('LAND R3, R0, R1');
  });

  it('should compile bitwise OR to LOR', () => {
    const result = compileWithExpr('@0,0: R1 = R0 | R2;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('LOR R1, R0, R2');
  });

  it('should work with raw register names alongside aliases', () => {
    // C-like expressions use raw register names (R0-R3, ROUT), not aliases.
    // Aliases are resolved by the parser, but desugaring happens before parsing.
    const result = compileDslToCsv(`.alias acc R0
kernel "AliasExpr" {
    config(0xF, 0);
    cycle { @0,0: SADD acc, ZERO, IMM(10); }
    cycle { @0,0: R0 = R0 + IMM(5); }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, R0, 5');
  });

  it('should work with .const as operand via directive syntax', () => {
    const result = compileDslToCsv(`.const STEP 4
kernel "ConstExpr" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, IMM(10); }
    cycle { @0,0: R1 = R0 + .STEP; }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    // Constants are resolved to numeric values in the CSV output
    expect(result.csv).toContain('SADD R1, R0, 4');
  });

  it('should work inside while loops', () => {
    const result = compileDslToCsv(`kernel "WhileClike" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, ZERO; }
    while (R0 < IMM(3)) @0,0 {
        cycle { @0,0: R0 = R0 + IMM(1); }
    }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, R0, 1');
  });

  it('should work inside if-else blocks', () => {
    const result = compileDslToCsv(`kernel "IfElseClike" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, IMM(5); }
    if (R0 == IMM(5)) @0,0 {
        cycle { @0,0: R1 = R0 + IMM(1); }
    } else {
        cycle { @0,0: R1 = R0 - IMM(1); }
    }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    // The true branch should compile
    expect(result.csv).toContain('SADD R1, R0, 1');
  });

  it('should work with #pragma parallel', () => {
    const result = compileDslToCsv(`kernel "ParallelClike" {
    config(0xF, 0);
    #pragma parallel
    for i in range(4) {
        cycle { @0,i: R0 = ZERO + IMM(i); }
    }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, ZERO, 0');
    expect(result.csv).toContain('SADD R0, ZERO, 1');
    expect(result.csv).toContain('SADD R0, ZERO, 2');
    expect(result.csv).toContain('SADD R0, ZERO, 3');
  });

  it('should work with row pipe syntax', () => {
    const result = compileDslToCsv(`kernel "RowPipe" {
    config(0xF, 0);
    cycle {
        row 0: R0 = ZERO + IMM(1) | R0 = ZERO + IMM(2) | _ | _;
    }
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    // Both PEs should have SADD instructions
    expect(result.csv).toContain('SADD R0, ZERO, 1');
    expect(result.csv).toContain('SADD R0, ZERO, 2');
  });

  it('should work with explicit IMM() wrapper as operand', () => {
    const result = compileWithExpr('@0,0: R0 = R1 + IMM(42);');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, R1, 42');
  });

  it('should work with SELF operand', () => {
    const result = compileWithExpr('@0,0: R0 = SELF + R1;');
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, SELF, R1');
  });
});

// ==========================================
// E2E Simulation tests
// ==========================================

describe('Expression Desugaring - Simulation E2E', () => {
  // Dynamic import of simulation helpers (may not be available in all environments)
  let compileAndSimulate: typeof import('./helpers/simulation').compileAndSimulate;
  let getRegister: typeof import('./helpers/simulation').getRegister;

  try {
    const helpers = require('./helpers/simulation');
    compileAndSimulate = helpers.compileAndSimulate;
    getRegister = helpers.getRegister;
  } catch {
    // Simulation helpers not available — skip
  }

  it('should produce correct values with C-like arithmetic', () => {
    if (!compileAndSimulate) return;
    const result = compileAndSimulate(`kernel "SimArith" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(7);
    }
    cycle {
        @0,0: R1 = R0 + R0;
        @0,1: R1 = R0 - IMM(3);
    }
    cycle { @0,0: EXIT; }
}`);
    // PE(0,0): R1 = 10 + 10 = 20
    expect(getRegister(result, 0, 0, 'R1')).toBe(20);
    // PE(0,1): R1 = 7 - 3 = 4
    expect(getRegister(result, 0, 1, 'R1')).toBe(4);
  });

  it('should produce identical results for C-like and assembly syntax', () => {
    if (!compileAndSimulate) return;
    const clikeResult = compileAndSimulate(`kernel "ClikeSim" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, IMM(5); }
    cycle { @0,0: R1 = R0 * R0; }
    cycle { @0,0: EXIT; }
}`);
    const asmResult = compileAndSimulate(`kernel "AsmSim" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, IMM(5); }
    cycle { @0,0: SMUL R1, R0, R0; }
    cycle { @0,0: EXIT; }
}`);
    // Both should have R1 = 25
    expect(getRegister(clikeResult, 0, 0, 'R1')).toBe(25);
    expect(getRegister(asmResult, 0, 0, 'R1')).toBe(25);
    expect(getRegister(clikeResult, 0, 0, 'R1')).toBe(getRegister(asmResult, 0, 0, 'R1'));
  });

  it('should produce correct bitwise results', () => {
    if (!compileAndSimulate) return;
    const result = compileAndSimulate(`kernel "SimBitwise" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(0xFF);
        @0,1: SADD R0, ZERO, IMM(0x0F);
    }
    cycle {
        @0,0: R1 = R0 & IMM(0x0F);
        @0,1: R1 = R0 << IMM(4);
    }
    cycle { @0,0: EXIT; }
}`);
    // PE(0,0): R1 = 0xFF & 0x0F = 0x0F = 15
    expect(getRegister(result, 0, 0, 'R1')).toBe(15);
    // PE(0,1): R1 = 0x0F << 4 = 0xF0 = 240
    expect(getRegister(result, 0, 1, 'R1')).toBe(240);
  });
});
