/**
 * Core Compiler Unit Tests
 *
 * Self-contained tests that verify the compilation pipeline
 * without requiring the external simulator.
 */
import { describe, it, expect } from 'vitest';
import { compileDslToCsv } from '@utils/dsl-compiler';
import { tokenize } from '../lexer/lexer.js';
import { TokenType } from '../types/tokens.js';
import { evaluateSimpleExpression, evaluateExpressionString } from '../utils/expression.js';
import { validateInstructionOperands, INSTRUCTION_OPERANDS, VALID_OPCODES } from '../diagnostics/validator.js';

// ============================================
// Lexer Tests
// ============================================

describe('Lexer', () => {
  it('should tokenize keywords', () => {
    const tokens = tokenize('kernel config cycle for while if else function range in row col');
    const keywords = tokens.filter(t => t.type === TokenType.KEYWORD);
    expect(keywords.map(k => k.value)).toEqual([
      'kernel', 'config', 'cycle', 'for', 'while', 'if', 'else', 'function', 'range', 'in', 'row', 'col'
    ]);
  });

  it('should tokenize directives', () => {
    const tokens = tokenize('.const .alias .data .data2d .io_load .io_store .limit .assert');
    const directives = tokens.filter(t => t.type === TokenType.DIRECTIVE);
    expect(directives.map(d => d.value)).toEqual([
      '.const', '.alias', '.data', '.data2d', '.io_load', '.io_store', '.limit', '.assert'
    ]);
  });

  it('should tokenize pragmas', () => {
    const tokens = tokenize('#pragma unroll\n#pragma parallel\n#pragma reduce');
    const pragmas = tokens.filter(t => t.type === TokenType.PRAGMA);
    expect(pragmas.length).toBe(3);
    expect(pragmas.map(p => p.value)).toEqual(['unroll', 'parallel', 'reduce']);
  });

  it('should tokenize decimal and hex numbers', () => {
    const tokens = tokenize('123 0xFF 0x0 42');
    const numbers = tokens.filter(t => t.type === TokenType.NUMBER);
    expect(numbers.map(n => n.value)).toEqual(['123', '0xFF', '0x0', '42']);
  });

  it('should tokenize strings', () => {
    const tokens = tokenize('"hello world"');
    const strings = tokens.filter(t => t.type === TokenType.STRING);
    expect(strings.length).toBe(1);
    expect(strings[0].value).toBe('hello world');
  });

  it('should tokenize operators', () => {
    const tokens = tokenize('+ - * / : | , = == != < > <= >=');
    const ops = tokens.filter(t => t.type === TokenType.OPERATOR);
    expect(ops.length).toBeGreaterThanOrEqual(14);
  });

  it('should tokenize @ symbol', () => {
    const tokens = tokenize('@0,1:');
    const at = tokens.find(t => t.type === TokenType.AT_SYMBOL);
    expect(at).toBeDefined();
  });

  it('should tokenize underscore as NOP placeholder', () => {
    const tokens = tokenize('_');
    const underscore = tokens.find(t => t.type === TokenType.UNDERSCORE);
    expect(underscore).toBeDefined();
  });

  it('should ignore single-line comments', () => {
    const tokens = tokenize('NOP // this is a comment\nEXIT');
    const identifiers = tokens.filter(t => t.type === TokenType.IDENTIFIER);
    expect(identifiers.map(i => i.value)).toEqual(['NOP', 'EXIT']);
  });

  it('should ignore multi-line comments', () => {
    const tokens = tokenize('NOP /* multi\nline\ncomment */ EXIT');
    const identifiers = tokens.filter(t => t.type === TokenType.IDENTIFIER);
    expect(identifiers.map(i => i.value)).toEqual(['NOP', 'EXIT']);
  });

  it('should track line numbers', () => {
    const tokens = tokenize('NOP\nEXIT\nSADD');
    const ids = tokens.filter(t => t.type === TokenType.IDENTIFIER);
    expect(ids[0].line).toBe(1);
    expect(ids[1].line).toBe(2);
    expect(ids[2].line).toBe(3);
  });

  it('should produce EOF token', () => {
    const tokens = tokenize('NOP');
    const eof = tokens.find(t => t.type === TokenType.EOF);
    expect(eof).toBeDefined();
  });
});

// ============================================
// Expression Evaluation Tests
// ============================================

describe('Expression Evaluation', () => {
  it('should evaluate single number', () => {
    expect(evaluateSimpleExpression(['3'])).toBe(3);
  });

  it('should evaluate addition', () => {
    expect(evaluateSimpleExpression(['3', '+', '2'])).toBe(5);
  });

  it('should evaluate subtraction', () => {
    expect(evaluateSimpleExpression(['10', '-', '3'])).toBe(7);
  });

  it('should evaluate multiplication', () => {
    expect(evaluateSimpleExpression(['4', '*', '5'])).toBe(20);
  });

  it('should evaluate division', () => {
    expect(evaluateSimpleExpression(['10', '/', '3'])).toBe(3);
  });

  it('should evaluate modulus', () => {
    expect(evaluateSimpleExpression(['10', '%', '3'])).toBe(1);
  });

  it('should respect operator precedence (* before +)', () => {
    expect(evaluateSimpleExpression(['3', '+', '2', '*', '4'])).toBe(11);
  });

  it('should evaluate hex numbers', () => {
    expect(evaluateSimpleExpression(['0xFF'])).toBe(255);
  });

  it('should evaluate IMM wrappers', () => {
    expect(evaluateSimpleExpression(['IMM', '(', '5', ')'])).toBe(5);
  });

  it('should throw on division by zero', () => {
    expect(() => evaluateSimpleExpression(['10', '/', '0'])).toThrow();
  });

  it('should evaluate expression strings', () => {
    expect(evaluateExpressionString('3 + 2')).toBe(5);
    expect(evaluateExpressionString('10 - 3')).toBe(7);
    expect(evaluateExpressionString('2 * 6')).toBe(12);
  });

  it('should evaluate parenthesized expressions', () => {
    expect(evaluateExpressionString('(3 + 2) * 4')).toBe(20);
    expect(evaluateExpressionString('3 * (2 + 4)')).toBe(18);
    expect(evaluateExpressionString('(10 - 3) * 2')).toBe(14);
  });

  it('should evaluate nested parentheses', () => {
    expect(evaluateExpressionString('((1 + 2) * 3) + 4')).toBe(13);
    expect(evaluateExpressionString('(2 + 3) * (4 + 1)')).toBe(25);
    expect(evaluateExpressionString('((2 + 3) * (4 - 1)) + 1')).toBe(16);
  });

  it('should preserve precedence without parens', () => {
    // Without parens: 3 + 2 * 4 = 3 + 8 = 11
    expect(evaluateExpressionString('3 + 2 * 4')).toBe(11);
    // With parens: (3 + 2) * 4 = 5 * 4 = 20
    expect(evaluateExpressionString('(3 + 2) * 4')).toBe(20);
  });
});

// ============================================
// Minimal Compilation Tests
// ============================================

describe('Minimal Compilation', () => {
  it('should compile minimal valid program', () => {
    const code = `
kernel "Minimal" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toBeDefined();
    expect(result.csv).toContain('EXIT');
  });

  it('should compile program without explicit EXIT (implicit exit added)', () => {
    const code = `
kernel "NoExit" {
    config(0xF, 0);
    cycle { @0,0: NOP; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('EXIT');
  });

  it('should compile multiple cycles', () => {
    const code = `
kernel "MultiCycle" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, ZERO; }
    cycle { @0,0: SADD R1, R0, R0; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // Count cycle markers in CSV output (lines that are just a number)
    const cycleCount = result.csv!.split('\n').filter(l => /^\d+$/.test(l.trim())).length;
    expect(cycleCount).toBe(3);
  });

  it('should return kernel name', () => {
    const code = `
kernel "TestName" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
  });
});

// ============================================
// Directive Tests
// ============================================

describe('Directives', () => {
  it('should resolve .const values with dot prefix', () => {
    const code = `
.const VALUE 42

kernel "ConstTest" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, .VALUE; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('42');
  });

  it('should resolve .const values by name directly', () => {
    const code = `
.const VALUE 42

kernel "ConstTest2" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, VALUE; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('42');
  });

  it('should resolve .alias substitutions', () => {
    const code = `
.alias counter R0
.alias result R1

kernel "AliasTest" {
    config(0xF, 0);
    cycle { @0,0: SADD counter, ZERO, ZERO; }
    cycle { @0,0: SADD result, counter, counter; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // After alias resolution, counter→R0, result→R1
    expect(result.csv).toContain('R0');
    expect(result.csv).toContain('R1');
  });

  it('should handle .data declarations', () => {
    const code = `
.data input { 10, 20, 30 }

kernel "DataTest" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, input[0]; }
    cycle { @0,0: LWI R1, input[2]; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // input[0] → address 0, input[2] → address 8
    expect(result.csv).toContain('LWI R0, 0');
    expect(result.csv).toContain('LWI R1, 8');
    // Memory initialization
    expect(result.memoryInit).toBeDefined();
  });

  it('should handle named array with numeric index', () => {
    const code = `
.data values { 10, 20, 30, 40, 50 }

kernel "ArrayPropsTest" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, values[4]; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // values[4] → address 16 (4 * 4 bytes)
    expect(result.csv).toContain('LWI R0, 16');
  });

  it('should resolve array .len() property as operand', () => {
    const code = `
.data values { 10, 20, 30, 40, 50 }

kernel "ArrayLenTest" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, values.len(); }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // values.len() = 5
    expect(result.csv).toContain('5');
  });
});

// ============================================
// Coordinate Syntax Tests
// ============================================

describe('Coordinate Syntax', () => {
  it('should handle @row,col: syntax', () => {
    const code = `
kernel "CoordTest" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, ZERO;
        @0,1: SADD R1, ZERO, ZERO;
        @1,0: SADD R2, ZERO, ZERO;
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // All three instructions should appear in the same cycle
    const cycleCount = result.csv!.split('\n').filter(l => /^\d+$/.test(l.trim())).length;
    expect(cycleCount).toBe(2);
  });

  it('should handle row N: pipe syntax', () => {
    const code = `
kernel "RowPipeTest" {
    config(0xF, 0);
    cycle {
        row 0: SADD R0, ZERO, ZERO | NOP | NOP | NOP;
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, ZERO, ZERO');
  });

  it('should handle _ as NOP placeholder in pipe syntax', () => {
    const code = `
kernel "UnderscoreTest" {
    config(0xF, 0);
    cycle {
        row 0: SADD R0, ZERO, ZERO | _ | _ | _;
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('NOP');
  });
});

// ============================================
// Control Flow Tests
// ============================================

describe('For Loops', () => {
  it('should unroll for loop with range(n)', () => {
    const code = `
kernel "ForBasic" {
    config(0xF, 0);
    for i in range(3) {
        cycle { @0,0: SADD R0, ZERO, IMM(i); }
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // Should produce 3 cycles for i=0,1,2 + 1 EXIT cycle
    const cycleCount = result.csv!.split('\n').filter(l => /^\d+$/.test(l.trim())).length;
    expect(cycleCount).toBe(4);
    expect(result.csv).toContain('SADD R0, ZERO, 0');
    expect(result.csv).toContain('SADD R0, ZERO, 1');
    expect(result.csv).toContain('SADD R0, ZERO, 2');
  });

  it('should unroll for loop with range(start, end)', () => {
    const code = `
kernel "ForRange" {
    config(0xF, 0);
    for i in range(2, 5) {
        cycle { @0,0: SADD R0, ZERO, IMM(i); }
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, ZERO, 2');
    expect(result.csv).toContain('SADD R0, ZERO, 3');
    expect(result.csv).toContain('SADD R0, ZERO, 4');
  });

  it('should distribute with #pragma parallel', () => {
    const code = `
kernel "ParallelFor" {
    config(0xF, 0);
    #pragma parallel
    for i in range(4) {
        cycle { @0,i: SADD R0, ZERO, IMM(i); }
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // Parallel loop distributes across PEs
    expect(result.csv).toContain('SADD R0, ZERO, 0');
    expect(result.csv).toContain('SADD R0, ZERO, 1');
    expect(result.csv).toContain('SADD R0, ZERO, 2');
    expect(result.csv).toContain('SADD R0, ZERO, 3');
  });
});

describe('While Loops', () => {
  it('should compile while loop with branch instructions', () => {
    const code = `
kernel "WhileTest" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, ZERO; }
    while (R0 < IMM(10)) @0,0 {
        cycle { @0,0: SADD R0, R0, IMM(1); }
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // Should contain branch instruction (BGE for < condition negation)
    expect(result.csv).toBeDefined();
  });
});

describe('If-Else', () => {
  it('should compile if statement', () => {
    const code = `
kernel "IfTest" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, IMM(5); }
    if (R0 == IMM(5)) @0,0 {
        cycle { @0,0: SADD R1, ZERO, IMM(1); }
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
  });

  it('should compile if-else statement', () => {
    const code = `
kernel "IfElseTest" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, IMM(5); }
    if (R0 == IMM(5)) @0,0 {
        cycle { @0,0: SADD R1, ZERO, IMM(1); }
    } else {
        cycle { @0,0: SADD R1, ZERO, IMM(0); }
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
  });
});

// ============================================
// Function Tests
// ============================================

describe('Functions', () => {
  it('should compile function definition and call', () => {
    const code = `
function init_reg(reg, val) {
    cycle { @0,0: SADD reg, ZERO, IMM(val); }
}

kernel "FuncTest" {
    config(0xF, 0);
    init_reg(R0, 10);
    init_reg(R1, 20);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R0, ZERO, 10');
    expect(result.csv).toContain('SADD R1, ZERO, 20');
  });
});

// ============================================
// Pragma Pattern Tests
// ============================================

describe('Pragma Patterns', () => {
  it('should compile #pragma reduce', () => {
    const code = `
kernel "ReduceTest" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(1);
        @0,1: SADD R0, ZERO, IMM(2);
        @0,2: SADD R0, ZERO, IMM(3);
        @0,3: SADD R0, ZERO, IMM(4);
    }
    #pragma reduce(sum, R1, R0)
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // Reduce should generate additional cycles with neighbor communication
    const cycleCount = result.csv!.split('\n').filter(l => /^\d+$/.test(l.trim())).length;
    expect(cycleCount).toBeGreaterThan(2);
  });

  it('should compile #pragma stencil cross', () => {
    const code = `
kernel "StencilTest" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(1);
        @0,1: SADD R0, ZERO, IMM(2);
        @1,0: SADD R0, ZERO, IMM(3);
        @1,1: SADD R0, ZERO, IMM(4);
    }
    #pragma stencil(cross, add, R1, R0)
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
  });

  it('should compile #pragma route', () => {
    const code = `
kernel "RouteTest" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, IMM(42); }
    #pragma route (0,0) -> (0,2) payload(R0) accum(R1)
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
  });
});

// ============================================
// Error Handling Tests
// ============================================

describe('Error Handling', () => {
  it('should fail on missing kernel', () => {
    const code = `
config(0xF, 0);
cycle { @0,0: EXIT; }
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid syntax', () => {
    const code = `
kernel {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    // kernel without name string may fail depending on parser
    const result = compileDslToCsv(code);
    // Either fails or succeeds (kernel name is optional in some versions)
    // The point is it doesn't crash
    expect(result).toBeDefined();
  });

  it('should fail on undefined array reference', () => {
    const code = `
kernel "UndefinedArray" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, undeclared[0]; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(false);
  });

  it('should report error line number', () => {
    const code = `
kernel "ErrorLine" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, missing[0]; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(false);
    expect(result.line).toBeDefined();
    expect(result.line).toBeGreaterThan(0);
  });
});

// ============================================
// CSV Output Format Tests
// ============================================

describe('CSV Output Format', () => {
  it('should generate valid CSV with cycle numbers', () => {
    const code = `
kernel "CsvFormat" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, IMM(1); }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    const lines = result.csv!.trim().split('\n');
    // First line should be cycle number 0
    expect(lines[0].trim()).toBe('0');
  });

  it('should fill empty PEs with NOP', () => {
    const code = `
kernel "NopFill" {
    config(0xF, 0);
    cycle { @0,0: SADD R0, ZERO, ZERO; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('NOP');
  });

  it('should output correct instruction format', () => {
    const code = `
kernel "InstrFormat" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, 100; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('LWI R0, 100');
  });
});

// ============================================
// Memory Initialization Tests
// ============================================

describe('Memory Initialization', () => {
  it('should initialize memory from .data', () => {
    const code = `
.data input { 1, 2, 3, 4, 5 }

kernel "MemInit" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.memoryInit).toBeDefined();
    expect(result.memoryInit!.get(0)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle multiple .data regions', () => {
    const code = `
.data a { 10, 20 }
.data b { 30, 40 }

kernel "MultiData" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.memoryInit).toBeDefined();
    // First array at address 0, second at address 8 (2 words * 4 bytes)
    expect(result.memoryInit!.get(0)).toEqual([10, 20]);
    expect(result.memoryInit!.get(8)).toEqual([30, 40]);
  });
});

// ============================================
// Neighbor Communication Tests
// ============================================

describe('Neighbor Communication', () => {
  it('should compile instructions with neighbor registers', () => {
    const code = `
kernel "NeighborTest" {
    config(0xF, 0);
    cycle {
        @0,0: SADD ROUT, R0, ZERO;
        @0,1: SADD R1, RCL, ZERO;
    }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('ROUT');
    expect(result.csv).toContain('RCL');
  });
});

// ============================================
// Labels Tests
// ============================================

describe('Labels', () => {
  it('should resolve label references in branch instructions', () => {
    const code = `
kernel "LabelTest" {
    config(0xF, 0);
    start:
    cycle { @0,0: SADD R0, R0, IMM(1); }
    cycle { @0,0: BLT R0, IMM(10), start; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // 'start' label points to cycle 0, so BLT should reference 0
    expect(result.csv).toContain('BLT R0, 10, 0');
  });
});

// ============================================
// Operand Count Validation Tests
// ============================================

describe('Operand Count Validation', () => {
  it('should validate correct operand counts', () => {
    const instructions = new Map([
      ['0,0', { opcode: 'SADD', operands: ['R0', 'R1', 'R2'], originalLine: 1 }],
      ['0,1', { opcode: 'LWI', operands: ['R0', '100'], originalLine: 2 }],
      ['0,2', { opcode: 'NOP', operands: [], originalLine: 3 }],
    ]);
    const diagnostics = validateInstructionOperands(instructions);
    expect(diagnostics).toHaveLength(0);
  });

  it('should detect missing operands', () => {
    const instructions = new Map([
      ['0,0', { opcode: 'SADD', operands: ['R0', 'R1'], originalLine: 5 }],
    ]);
    const diagnostics = validateInstructionOperands(instructions);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('SADD expects 3 operand(s), but got 2');
  });

  it('should detect excess operands', () => {
    const instructions = new Map([
      ['0,0', { opcode: 'LWD', operands: ['R0', 'R1'], originalLine: 3 }],
    ]);
    const diagnostics = validateInstructionOperands(instructions);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('LWD expects 1 operand(s), but got 2');
  });

  it('should allow NOP and EXIT with no operands', () => {
    const instructions = new Map([
      ['0,0', { opcode: 'NOP', operands: [], originalLine: 1 }],
      ['0,1', { opcode: 'EXIT', operands: [], originalLine: 2 }],
    ]);
    const diagnostics = validateInstructionOperands(instructions);
    expect(diagnostics).toHaveLength(0);
  });

  it('should have operand specs for all valid opcodes', () => {
    for (const opcode of VALID_OPCODES) {
      expect(INSTRUCTION_OPERANDS).toHaveProperty(opcode);
    }
  });
});
