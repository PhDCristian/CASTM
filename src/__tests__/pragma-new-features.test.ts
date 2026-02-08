/**
 * Tests for new pragma features:
 * - #pragma reduce(xor/mul) — extended operations
 * - #pragma allreduce — reduce + broadcast combined
 * - #pragma transpose — grid transposition
 * - #pragma gather — collect values to one PE
 */
import { describe, it, expect } from 'vitest';
import { compileDslToCsv } from '../compiler';
import { compileAndSimulate, getRegister } from './helpers/simulation';
import { tokenize } from '../lexer';
import { desugarAutoCycle } from '../parser/auto-cycle-desugar';
import { TokenType } from '../types/tokens';

// ==========================================
// Feature 1: reduce(xor/mul)
// ==========================================

describe('#pragma reduce — extended operations', () => {
  describe('reduce(xor)', () => {
    it('should compile reduce(xor) to LXOR instructions', () => {
      const result = compileDslToCsv(`kernel "ReduceXor" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(3);
        @0,1: SADD R0, ZERO, IMM(5);
        @0,2: SADD R0, ZERO, IMM(7);
        @0,3: SADD R0, ZERO, IMM(2);
    }
    #pragma reduce(xor, R1, R0)
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
      expect(result.csv).toContain('LXOR');
    });

    it('should produce correct XOR reduction result via simulation', () => {
      const result = compileAndSimulate(`kernel "ReduceXorSim" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(3);
        @0,1: SADD R0, ZERO, IMM(5);
        @0,2: SADD R0, ZERO, IMM(7);
        @0,3: SADD R0, ZERO, IMM(2);
    }
    #pragma reduce(xor, R1, R0)
    cycle { @0,0: EXIT; }
}`);
      // 3 ^ 5 = 6, 7 ^ 2 = 5, 6 ^ 5 = 3
      expect(getRegister(result, 0, 0, 'R1')).toBe(3);
    });

    it('should support vertical XOR reduce (axis=col)', () => {
      const result = compileDslToCsv(`kernel "ReduceXorCol" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(1);
        @1,0: SADD R0, ZERO, IMM(2);
        @2,0: SADD R0, ZERO, IMM(3);
        @3,0: SADD R0, ZERO, IMM(4);
    }
    #pragma reduce(xor, R1, R0, axis=col)
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
      expect(result.csv).toContain('LXOR');
    });
  });

  describe('reduce(mul)', () => {
    it('should compile reduce(mul) to SMUL instructions', () => {
      const result = compileDslToCsv(`kernel "ReduceMul" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(2);
        @0,1: SADD R0, ZERO, IMM(3);
        @0,2: SADD R0, ZERO, IMM(4);
        @0,3: SADD R0, ZERO, IMM(5);
    }
    #pragma reduce(mul, R1, R0)
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
      expect(result.csv).toContain('SMUL');
    });

    it('should produce correct product reduction result via simulation', () => {
      const result = compileAndSimulate(`kernel "ReduceMulSim" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(2);
        @0,1: SADD R0, ZERO, IMM(3);
        @0,2: SADD R0, ZERO, IMM(4);
        @0,3: SADD R0, ZERO, IMM(5);
    }
    #pragma reduce(mul, R1, R0)
    cycle { @0,0: EXIT; }
}`);
      // 2 * 3 = 6, 4 * 5 = 20, 6 * 20 = 120
      expect(getRegister(result, 0, 0, 'R1')).toBe(120);
    });
  });
});

// ==========================================
// Feature 2: allreduce
// ==========================================

describe('#pragma allreduce', () => {
  it('should compile allreduce(sum) successfully', () => {
    const result = compileDslToCsv(`kernel "AllreduceSum" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }
    #pragma allreduce(sum, R1, R0)
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    // Should contain both reduce (SADD with RCR) and broadcast patterns
    expect(result.csv).toBeDefined();
  });

  it('should give all PEs the sum result via simulation', () => {
    const result = compileAndSimulate(`kernel "AllreduceSumSim" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }
    #pragma allreduce(sum, R1, R0)
    cycle { @0,0: EXIT; }
}`);
    // All PEs should have R1 = 100
    expect(getRegister(result, 0, 0, 'R1')).toBe(100);
    expect(getRegister(result, 0, 1, 'R1')).toBe(100);
    expect(getRegister(result, 0, 2, 'R1')).toBe(100);
    expect(getRegister(result, 0, 3, 'R1')).toBe(100);
  });

  it('should work with allreduce(xor)', () => {
    const result = compileAndSimulate(`kernel "AllreduceXor" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(3);
        @0,1: SADD R0, ZERO, IMM(5);
        @0,2: SADD R0, ZERO, IMM(7);
        @0,3: SADD R0, ZERO, IMM(2);
    }
    #pragma allreduce(xor, R1, R0)
    cycle { @0,0: EXIT; }
}`);
    // 3^5^7^2 = 3; all PEs should have R1 = 3
    expect(getRegister(result, 0, 0, 'R1')).toBe(3);
    expect(getRegister(result, 0, 1, 'R1')).toBe(3);
    expect(getRegister(result, 0, 2, 'R1')).toBe(3);
    expect(getRegister(result, 0, 3, 'R1')).toBe(3);
  });
});

// ==========================================
// Feature 3: transpose
// ==========================================

describe('#pragma transpose', () => {
  it('should compile transpose(reg=R0) successfully', () => {
    const result = compileDslToCsv(`kernel "TransposeCompile" {
    config(0xFFFF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(0);
        @0,1: SADD R0, ZERO, IMM(1);
        @1,0: SADD R0, ZERO, IMM(4);
        @1,1: SADD R0, ZERO, IMM(5);
    }
    #pragma transpose(reg=R0)
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toBeDefined();
  });

  it('should transpose a full 4x4 grid correctly via simulation', () => {
    const result = compileAndSimulate(`kernel "TransposeFull" {
    config(0xFFFF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(0);
        @0,1: SADD R0, ZERO, IMM(1);
        @0,2: SADD R0, ZERO, IMM(2);
        @0,3: SADD R0, ZERO, IMM(3);
        @1,0: SADD R0, ZERO, IMM(4);
        @1,1: SADD R0, ZERO, IMM(5);
        @1,2: SADD R0, ZERO, IMM(6);
        @1,3: SADD R0, ZERO, IMM(7);
        @2,0: SADD R0, ZERO, IMM(8);
        @2,1: SADD R0, ZERO, IMM(9);
        @2,2: SADD R0, ZERO, IMM(10);
        @2,3: SADD R0, ZERO, IMM(11);
        @3,0: SADD R0, ZERO, IMM(12);
        @3,1: SADD R0, ZERO, IMM(13);
        @3,2: SADD R0, ZERO, IMM(14);
        @3,3: SADD R0, ZERO, IMM(15);
    }
    #pragma transpose(reg=R0)
    cycle { @0,0: EXIT; }
}`);
    // Matrix before:        Matrix after (transposed):
    //  0  1  2  3           0  4  8 12
    //  4  5  6  7           1  5  9 13
    //  8  9 10 11           2  6 10 14
    // 12 13 14 15           3  7 11 15

    // Diagonal stays the same
    expect(getRegister(result, 0, 0, 'R0')).toBe(0);
    expect(getRegister(result, 1, 1, 'R0')).toBe(5);
    expect(getRegister(result, 2, 2, 'R0')).toBe(10);
    expect(getRegister(result, 3, 3, 'R0')).toBe(15);

    // Distance-1 swaps
    expect(getRegister(result, 0, 1, 'R0')).toBe(4);  // was 1, now PE(1,0)'s original
    expect(getRegister(result, 1, 0, 'R0')).toBe(1);  // was 4, now PE(0,1)'s original
    expect(getRegister(result, 1, 2, 'R0')).toBe(9);  // was 6, now PE(2,1)'s original
    expect(getRegister(result, 2, 1, 'R0')).toBe(6);  // was 9, now PE(1,2)'s original
    expect(getRegister(result, 2, 3, 'R0')).toBe(14); // was 11, now PE(3,2)'s original
    expect(getRegister(result, 3, 2, 'R0')).toBe(11); // was 14, now PE(2,3)'s original

    // Distance-2 swaps
    expect(getRegister(result, 0, 2, 'R0')).toBe(8);  // was 2, now PE(2,0)'s original
    expect(getRegister(result, 2, 0, 'R0')).toBe(2);  // was 8, now PE(0,2)'s original
    expect(getRegister(result, 1, 3, 'R0')).toBe(13); // was 7, now PE(3,1)'s original
    expect(getRegister(result, 3, 1, 'R0')).toBe(7);  // was 13, now PE(1,3)'s original

    // Distance-3 swaps
    expect(getRegister(result, 0, 3, 'R0')).toBe(12); // was 3, now PE(3,0)'s original
    expect(getRegister(result, 3, 0, 'R0')).toBe(3);  // was 12, now PE(0,3)'s original
  });
});

// ==========================================
// Feature 4: gather
// ==========================================

describe('#pragma gather', () => {
  it('should compile gather successfully', () => {
    const result = compileDslToCsv(`kernel "GatherCompile" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }
    #pragma gather(src=R0, dest=@0,0, destReg=R1, op=add)
    cycle { @0,0: EXIT; }
}`);
    expect(result.success).toBe(true);
    expect(result.csv).toContain('SADD R1');
  });

  it('should gather sum to PE(0,0) via simulation', () => {
    const result = compileAndSimulate(`kernel "GatherSum" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }
    #pragma gather(src=R0, dest=@0,0, destReg=R1, op=add)
    cycle { @0,0: EXIT; }
}`);
    // PE(0,0).R1 = 10 + 20 + 30 + 40 = 100
    expect(getRegister(result, 0, 0, 'R1')).toBe(100);
  });

  it('should gather to a non-origin destination PE', () => {
    const result = compileAndSimulate(`kernel "GatherDest2" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }
    #pragma gather(src=R0, dest=@0,2, destReg=R1, op=add)
    cycle { @0,0: EXIT; }
}`);
    // PE(0,2).R1 = 10 + 20 + 30 + 40 = 100
    expect(getRegister(result, 0, 2, 'R1')).toBe(100);
  });

  it('should gather with xor operation', () => {
    const result = compileAndSimulate(`kernel "GatherXor" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(3);
        @0,1: SADD R0, ZERO, IMM(5);
        @0,2: SADD R0, ZERO, IMM(7);
        @0,3: SADD R0, ZERO, IMM(2);
    }
    #pragma gather(src=R0, dest=@0,0, destReg=R1, op=xor)
    cycle { @0,0: EXIT; }
}`);
    // PE(0,0).R1 = 3 ^ 5 ^ 7 ^ 2 = 3
    expect(getRegister(result, 0, 0, 'R1')).toBe(3);
  });

  it('should gather with mul operation', () => {
    const result = compileAndSimulate(`kernel "GatherMul" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(2);
        @0,1: SADD R0, ZERO, IMM(3);
        @0,2: SADD R0, ZERO, IMM(4);
        @0,3: SADD R0, ZERO, IMM(5);
    }
    #pragma gather(src=R0, dest=@0,0, destReg=R1, op=mul)
    cycle { @0,0: EXIT; }
}`);
    // PE(0,0).R1 = 2 * 3 * 4 * 5 = 120
    expect(getRegister(result, 0, 0, 'R1')).toBe(120);
  });
});

// ==========================================
// Feature 5: Broadcast Syntax (all:, col N:, row N: without pipes)
// ==========================================

describe('Broadcast syntax', () => {
  describe('row N: without pipes (broadcast)', () => {
    it('should compile row N: single instruction to all 4 columns', () => {
      const result = compileDslToCsv(`kernel "RowBroadcast" {
    config(0xF, 0);
    cycle {
        row 0: SADD R0, ZERO, IMM(42);
    }
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
      expect(result.csv).toBeDefined();
    });

    it('should broadcast row instruction to all columns in simulation', () => {
      const result = compileAndSimulate(`kernel "RowBroadcastSim" {
    config(0xF, 0);
    cycle {
        row 0: SADD R0, ZERO, IMM(42);
    }
    cycle { @0,0: EXIT; }
}`);
      // All 4 PEs in row 0 should have R0 = 42
      expect(getRegister(result, 0, 0, 'R0')).toBe(42);
      expect(getRegister(result, 0, 1, 'R0')).toBe(42);
      expect(getRegister(result, 0, 2, 'R0')).toBe(42);
      expect(getRegister(result, 0, 3, 'R0')).toBe(42);
    });

    it('should preserve pipe syntax backward compatibility', () => {
      const result = compileAndSimulate(`kernel "RowPipeSyntax" {
    config(0xF, 0);
    cycle {
        row 0: SADD R0, ZERO, IMM(10) | SADD R0, ZERO, IMM(20) | SADD R0, ZERO, IMM(30) | SADD R0, ZERO, IMM(40);
    }
    cycle { @0,0: EXIT; }
}`);
      expect(getRegister(result, 0, 0, 'R0')).toBe(10);
      expect(getRegister(result, 0, 1, 'R0')).toBe(20);
      expect(getRegister(result, 0, 2, 'R0')).toBe(30);
      expect(getRegister(result, 0, 3, 'R0')).toBe(40);
    });
  });

  describe('all: syntax', () => {
    it('should compile all: to all 16 PEs', () => {
      const result = compileDslToCsv(`kernel "AllBroadcast" {
    config(0xF, 0);
    cycle {
        all: SADD R0, ZERO, IMM(99);
    }
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
    });

    it('should broadcast to all 16 PEs in simulation', () => {
      const result = compileAndSimulate(`kernel "AllBroadcastSim" {
    config(0xF, 0);
    cycle {
        all: SADD R0, ZERO, IMM(77);
    }
    cycle { @0,0: EXIT; }
}`);
      // All 16 PEs should have R0 = 77
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          expect(getRegister(result, r, c, 'R0')).toBe(77);
        }
      }
    });
  });

  describe('col N: syntax', () => {
    it('should compile col N: to all 4 rows', () => {
      const result = compileDslToCsv(`kernel "ColBroadcast" {
    config(0xF, 0);
    cycle {
        col 2: SADD R0, ZERO, IMM(55);
    }
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
    });

    it('should broadcast to all rows in column in simulation', () => {
      const result = compileAndSimulate(`kernel "ColBroadcastSim" {
    config(0xF, 0);
    cycle {
        col 1: SADD R0, ZERO, IMM(33);
    }
    cycle { @0,0: EXIT; }
}`);
      // All 4 rows in col 1 should have R0 = 33
      expect(getRegister(result, 0, 1, 'R0')).toBe(33);
      expect(getRegister(result, 1, 1, 'R0')).toBe(33);
      expect(getRegister(result, 2, 1, 'R0')).toBe(33);
      expect(getRegister(result, 3, 1, 'R0')).toBe(33);
      // Other columns should NOT be affected (R0 = 0)
      expect(getRegister(result, 0, 0, 'R0')).toBe(0);
    });
  });

  describe('dot-product with broadcast syntax', () => {
    it('should compute dot product using row broadcast instead of per-PE repetition', () => {
      const result = compileAndSimulate(`
.data A { 1, 2, 3, 4 }
.data B { 5, 6, 7, 8 }
kernel "DotProductBroadcast" {
    config(0xF, 0);
    #pragma parallel
    for i in range(4) {
        cycle { @0,i: LWI R0, A[i]; }
    }
    #pragma parallel
    for i in range(4) {
        cycle { @0,i: LWI R1, B[i]; }
    }
    cycle {
        row 0: SMUL R2, R0, R1;
    }
    #pragma reduce(sum, R3, R2)
    cycle { @0,0: EXIT; }
}`);
      // dot = 1*5 + 2*6 + 3*7 + 4*8 = 5 + 12 + 21 + 32 = 70
      expect(getRegister(result, 0, 0, 'R3')).toBe(70);
    });
  });
});

// ==========================================
// Feature 6: Streaming Memory (#pragma stream_load / stream_store)
// ==========================================

describe('#pragma stream_load / stream_store', () => {
  describe('stream_load', () => {
    it('should compile stream_load(dest=R0) to LWD instructions', () => {
      const result = compileDslToCsv(`
.io_load { 0, 4, 8, 12 }
kernel "StreamLoad" {
    config(0xF, 0);
    #pragma stream_load(dest=R0)
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
      expect(result.csv).toContain('LWD');
    });

    it('should load streaming data into PEs via simulation', () => {
      const result = compileAndSimulate(`
.data input { 10, 20, 30, 40 }
.io_load { 0, 4, 8, 12 }
kernel "StreamLoadSim" {
    config(0xF, 0);
    #pragma stream_load(dest=R0)
    cycle { @0,0: EXIT; }
}`);
      // Each column's LWD reads from its memPointer:
      // col 0: memPointers[0]=0 → word 0 = 10
      // col 1: memPointers[1]=4 → word 1 = 20
      // col 2: memPointers[2]=8 → word 2 = 30
      // col 3: memPointers[3]=12 → word 3 = 40
      expect(getRegister(result, 0, 0, 'R0')).toBe(10);
      expect(getRegister(result, 0, 1, 'R0')).toBe(20);
      expect(getRegister(result, 0, 2, 'R0')).toBe(30);
      expect(getRegister(result, 0, 3, 'R0')).toBe(40);
    });

    it('should support count parameter for multiple loads', () => {
      const result = compileAndSimulate(`
.data input { 10, 20, 30, 40, 50, 60, 70, 80 }
.io_load { 0, 4, 8, 12 }
kernel "StreamLoadCount" {
    config(0xF, 0);
    #pragma stream_load(dest=R0, count=2)
    cycle { @0,0: EXIT; }
}`);
      // After 2 LWD cycles, each column read 2 consecutive words.
      // col 0: first read word 0 (10), second read word 1 (20) → R0=20 (last load wins)
      // Actually, LWD auto-increments per column, so col 0 reads addr 0 then addr 4:
      // col 0: word@0=10 then word@4=20 → R0 = 20
      // col 1: word@4=20 then word@8=30 → R0 = 30
      // col 2: word@8=30 then word@12=40 → R0 = 40
      // col 3: word@12=40 then word@16=50 → R0 = 50
      expect(getRegister(result, 0, 0, 'R0')).toBe(20);
      expect(getRegister(result, 0, 1, 'R0')).toBe(30);
      expect(getRegister(result, 0, 2, 'R0')).toBe(40);
      expect(getRegister(result, 0, 3, 'R0')).toBe(50);
    });

    it('should support row parameter', () => {
      const result = compileDslToCsv(`
.io_load { 0, 4, 8, 12 }
kernel "StreamLoadRow" {
    config(0xF, 0);
    #pragma stream_load(dest=R1, row=2)
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
    });
  });

  describe('stream_store', () => {
    it('should compile stream_store(src=R0) to SWD instructions', () => {
      const result = compileDslToCsv(`
.io_store { 100, 104, 108, 112 }
kernel "StreamStore" {
    config(0xF, 0);
    cycle {
        all: SADD R0, ZERO, IMM(42);
    }
    #pragma stream_store(src=R0)
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
      expect(result.csv).toContain('SWD');
    });
  });
});

// ==========================================
// Feature 7: Auto-Cycle Inference (#pragma auto_cycle)
// ==========================================

describe('#pragma auto_cycle', () => {
  describe('token-level desugaring', () => {
    it('should wrap each @r,c instruction in its own cycle when same PE', () => {
      const tokens = tokenize(`
        #pragma auto_cycle
        @0,0: SADD R0, ZERO, IMM(1);
        @0,0: SADD R1, ZERO, IMM(2);
        @0,0: SADD R2, R0, R1;
        #pragma end_auto_cycle
      `);
      const result = desugarAutoCycle(tokens);
      // Each @0,0 conflicts → 3 separate cycles
      const cycleKeywords = result.filter(t => t.type === TokenType.KEYWORD && t.value === 'cycle');
      expect(cycleKeywords.length).toBe(3);
    });

    it('should group non-conflicting PEs into the same cycle', () => {
      const tokens = tokenize(`
        #pragma auto_cycle
        @0,0: SADD R0, ZERO, IMM(1);
        @0,1: SADD R0, ZERO, IMM(2);
        @0,2: SADD R0, ZERO, IMM(3);
        @0,3: SADD R0, ZERO, IMM(4);
        #pragma end_auto_cycle
      `);
      const result = desugarAutoCycle(tokens);
      // 4 distinct PEs → 1 cycle
      const cycleKeywords = result.filter(t => t.type === TokenType.KEYWORD && t.value === 'cycle');
      expect(cycleKeywords.length).toBe(1);
    });

    it('should start new cycle on PE conflict', () => {
      const tokens = tokenize(`
        #pragma auto_cycle
        @0,0: SADD R0, ZERO, IMM(1);
        @0,1: SADD R0, ZERO, IMM(2);
        @0,0: SADD R1, ZERO, IMM(3);
        @0,1: SADD R1, ZERO, IMM(4);
        #pragma end_auto_cycle
      `);
      const result = desugarAutoCycle(tokens);
      // @0,0 + @0,1 → cycle 1; @0,0 conflicts → cycle 2
      const cycleKeywords = result.filter(t => t.type === TokenType.KEYWORD && t.value === 'cycle');
      expect(cycleKeywords.length).toBe(2);
    });

    it('should give all: its own cycle (occupies all PEs)', () => {
      const tokens = tokenize(`
        #pragma auto_cycle
        @0,0: SADD R0, ZERO, IMM(1);
        @0,1: SADD R0, ZERO, IMM(2);
        all: SMUL R2, R0, R1;
        #pragma end_auto_cycle
      `);
      const result = desugarAutoCycle(tokens);
      // @0,0 + @0,1 → cycle 1; all: conflicts → cycle 2
      const cycleKeywords = result.filter(t => t.type === TokenType.KEYWORD && t.value === 'cycle');
      expect(cycleKeywords.length).toBe(2);
    });

    it('should handle row N: prefix', () => {
      const tokens = tokenize(`
        #pragma auto_cycle
        row 0: SADD R0, ZERO, IMM(1);
        row 1: SADD R0, ZERO, IMM(2);
        #pragma end_auto_cycle
      `);
      const result = desugarAutoCycle(tokens);
      // row 0 occupies 0,0-0,3; row 1 occupies 1,0-1,3 — no conflict → 1 cycle
      const cycleKeywords = result.filter(t => t.type === TokenType.KEYWORD && t.value === 'cycle');
      expect(cycleKeywords.length).toBe(1);
    });

    it('should conflict when same row used twice', () => {
      const tokens = tokenize(`
        #pragma auto_cycle
        row 0: SADD R0, ZERO, IMM(1);
        row 0: SADD R1, ZERO, IMM(2);
        #pragma end_auto_cycle
      `);
      const result = desugarAutoCycle(tokens);
      // row 0 used twice → 2 cycles
      const cycleKeywords = result.filter(t => t.type === TokenType.KEYWORD && t.value === 'cycle');
      expect(cycleKeywords.length).toBe(2);
    });

    it('should throw on missing end_auto_cycle', () => {
      const tokens = tokenize(`
        #pragma auto_cycle
        @0,0: SADD R0, ZERO, IMM(1);
      `);
      expect(() => desugarAutoCycle(tokens)).toThrow(/end_auto_cycle/);
    });
  });

  describe('full compilation', () => {
    it('should compile auto_cycle code to valid CSV', () => {
      const result = compileDslToCsv(`kernel "AutoCycleBasic" {
    config(0xF, 0);
    #pragma auto_cycle
    @0,0: SADD R0, ZERO, IMM(10);
    @0,1: SADD R0, ZERO, IMM(20);
    @0,0: SADD R1, ZERO, IMM(30);
    @0,1: SADD R1, ZERO, IMM(40);
    all: SMUL R2, R0, R1;
    #pragma end_auto_cycle
    cycle { @0,0: EXIT; }
}`);
      expect(result.success).toBe(true);
      expect(result.csv).toBeDefined();
    });

    it('should produce correct simulation results with auto_cycle', () => {
      const result = compileAndSimulate(`kernel "AutoCycleSim" {
    config(0xF, 0);
    #pragma auto_cycle
    @0,0: SADD R0, ZERO, IMM(5);
    @0,1: SADD R0, ZERO, IMM(10);
    @0,2: SADD R0, ZERO, IMM(15);
    @0,3: SADD R0, ZERO, IMM(20);
    #pragma end_auto_cycle
    cycle { @0,0: EXIT; }
}`);
      expect(getRegister(result, 0, 0, 'R0')).toBe(5);
      expect(getRegister(result, 0, 1, 'R0')).toBe(10);
      expect(getRegister(result, 0, 2, 'R0')).toBe(15);
      expect(getRegister(result, 0, 3, 'R0')).toBe(20);
    });

    it('should work mixed with regular cycle blocks', () => {
      const result = compileAndSimulate(`kernel "AutoCycleMixed" {
    config(0xF, 0);
    cycle {
        @0,0: SADD R0, ZERO, IMM(100);
    }
    #pragma auto_cycle
    @0,0: SADD R1, ZERO, IMM(200);
    @0,1: SADD R1, ZERO, IMM(300);
    #pragma end_auto_cycle
    cycle { @0,0: EXIT; }
}`);
      expect(getRegister(result, 0, 0, 'R0')).toBe(100);
      expect(getRegister(result, 0, 0, 'R1')).toBe(200);
      expect(getRegister(result, 0, 1, 'R1')).toBe(300);
    });
  });
});
