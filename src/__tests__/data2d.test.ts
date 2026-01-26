import { describe, it, expect } from 'vitest';
import { compileDslToCsv } from '@utils/dsl-compiler';
import { parseProgram } from '@core/simulation/instruction';
import { runSimulation, MemoryRegion } from '@core/simulation/simulation';

describe('2D Array Support', () => {
  it('should parse .data2d with auto-init to zeros', () => {
    const code = `
.data2d A[4][4]

kernel "Test2D_AutoInit" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.memoryInit?.get(0)).toHaveLength(16); // 4x4 = 16
    expect(result.memoryInit?.get(0)).toEqual(new Array(16).fill(0));
    expect(result.suggestedGridSize).toEqual({ width: 4, height: 4 });
  });

  it('should parse .data2d with explicit values', () => {
    const code = `
.data2d B[2][3] { 1, 2, 3, 4, 5, 6 }

kernel "Test2D_ExplicitValues" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.memoryInit?.get(0)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.suggestedGridSize).toEqual({ width: 3, height: 2 });
  });

  it('should parse .data2d with single dimension (infer square)', () => {
    const code = `
.data2d C[16]

kernel "Test2D_InferSquare" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.memoryInit?.get(0)).toHaveLength(16);
    expect(result.suggestedGridSize).toEqual({ width: 4, height: 4 }); // sqrt(16) = 4
  });

  it('should support 2D array access A[i][j]', () => {
    const code = `
.data2d M[2][2] { 10, 20, 30, 40 }

kernel "Test2D_Access" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, M[0][0]; }
    cycle { @0,0: LWI R1, M[1][1]; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // M[0][0] should be at address 0 (base), M[1][1] should be at address (1*2+1)*4 = 12
    expect(result.csv).toContain('LWI R0, 0'); // M[0][0] at address 0
    expect(result.csv).toContain('LWI R1, 12'); // M[1][1] at address 12 (index 3 * 4 bytes)
  });

  it('should calculate correct row-major addresses', () => {
    const code = `
.data2d M[3][3] { 0, 1, 2, 3, 4, 5, 6, 7, 8 }

kernel "Test2D_RowMajor" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, M[0][2]; }
    cycle { @0,0: LWI R1, M[2][0]; }
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    // M[0][2] = index 0*3+2 = 2, address = 2*4 = 8
    // M[2][0] = index 2*3+0 = 6, address = 6*4 = 24
    expect(result.csv).toContain('LWI R0, 8'); // M[0][2]
    expect(result.csv).toContain('LWI R1, 24'); // M[2][0]
  });

  it('should return suggested grid size based on largest 2D array', () => {
    const code = `
.data2d Small[2][2]
.data2d Large[5][6]

kernel "Test2D_LargestGrid" {
    config(0xF, 0);
    cycle { @0,0: EXIT; }
}
`;
    const result = compileDslToCsv(code);
    expect(result.success).toBe(true);
    expect(result.suggestedGridSize).toEqual({ width: 6, height: 5 });
  });

  describe('2D Arrays with #pragma parallel collapse', () => {
    it('should work with collapse(2) for nested loops over 2D array (numeric range)', () => {
      // Using numeric ranges directly works fine
      const code = `
.data2d M[2][2] { 1, 2, 3, 4 }

kernel "Test2D_Collapse" {
    config(0xF, 0);

    #pragma parallel collapse(2)
    for i in range(2) {
        for j in range(2) {
            cycle { @j,i: LWI R0, M[i][j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);
      // With collapse(2), all 4 iterations (2x2) should be parallelized to 4 PEs in 1 cycle
      // PE @0,0 gets M[0][0]=1, PE @1,0 gets M[0][1]=2, PE @0,1 gets M[1][0]=3, PE @1,1 gets M[1][1]=4
      expect(result.csv).toContain('LWI R0, 0'); // M[0][0]
      expect(result.csv).toContain('LWI R0, 4'); // M[0][1]
      expect(result.csv).toContain('LWI R0, 8'); // M[1][0]
      expect(result.csv).toContain('LWI R0, 12'); // M[1][1]
    });

    it('should process matrix elements in parallel with collapse', () => {
      // Note: 'row' is reserved in DSL, use 'r' instead
      const code = `
.data2d A[3][3]

kernel "Test2D_MatrixParallel" {
    config(0xF, 0);

    #pragma parallel collapse(2)
    for r in range(3) {
        for c in range(3) {
            // Each PE initializes its matrix element
            cycle { @c,r: SADD R0, ZERO, IMM(r); }
            cycle { @c,r: SADD R1, ZERO, IMM(c); }
        }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);
      expect(result.suggestedGridSize).toEqual({ width: 3, height: 3 });
    });

    it('should compile 2x2 matrix multiplication with real values', () => {
      // Matrix multiplication test:
      // A = [[1, 2], [3, 4]]
      // B = [[5, 6], [7, 8]]
      // C = A * B = [[1*5+2*7, 1*6+2*8], [3*5+4*7, 3*6+4*8]]
      //           = [[19, 22], [43, 50]]
      const code = `
.data2d A[2][2] { 1, 2, 3, 4 }
.data2d B[2][2] { 5, 6, 7, 8 }
.data2d C[2][2]

kernel "MatMul2x2" {
    config(0xF, 0);

    #pragma parallel collapse(2)
    for i in range(2) {
        for j in range(2) {
            // Initialize accumulator
            cycle { @j,i: SADD R0, ZERO, ZERO; }

            // k=0: R1=A[i][0], R2=B[0][j], R3=R1*R2, R0+=R3
            cycle { @j,i: LWI R1, A[i][0]; }
            cycle { @j,i: LWI R2, B[0][j]; }
            cycle { @j,i: SMUL R3, R1, R2; }
            cycle { @j,i: SADD R0, R0, R3; }

            // k=1: R1=A[i][1], R2=B[1][j], R3=R1*R2, R0+=R3
            cycle { @j,i: LWI R1, A[i][1]; }
            cycle { @j,i: LWI R2, B[1][j]; }
            cycle { @j,i: SMUL R3, R1, R2; }
            cycle { @j,i: SADD R0, R0, R3; }

            // Store result to C[i][j]
            cycle { @j,i: SWI R0, C[i][j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);

      // Verify memory initialization
      // A starts at address 0: [1, 2, 3, 4]
      // B starts at address 16: [5, 6, 7, 8]
      // C starts at address 32: [0, 0, 0, 0]
      expect(result.memoryInit?.get(0)).toEqual([1, 2, 3, 4]);
      expect(result.memoryInit?.get(16)).toEqual([5, 6, 7, 8]);
      expect(result.memoryInit?.get(32)).toEqual([0, 0, 0, 0]);

      // Verify CSV contains correct array accesses
      // A[i][0] for i=0: address 0, i=1: address 8
      // A[i][1] for i=0: address 4, i=1: address 12
      // B[0][j] for j=0: address 16, j=1: address 20
      // B[1][j] for j=0: address 24, j=1: address 28
      // C[i][j] stores: (0,0)->32, (0,1)->36, (1,0)->40, (1,1)->44
      expect(result.csv).toContain('LWI R1, 0');  // A[0][0]
      expect(result.csv).toContain('LWI R1, 4');  // A[0][1]
      expect(result.csv).toContain('LWI R1, 8');  // A[1][0]
      expect(result.csv).toContain('LWI R1, 12'); // A[1][1]
      expect(result.csv).toContain('LWI R2, 16'); // B[0][0]
      expect(result.csv).toContain('LWI R2, 20'); // B[0][1]
      expect(result.csv).toContain('LWI R2, 24'); // B[1][0]
      expect(result.csv).toContain('LWI R2, 28'); // B[1][1]
      expect(result.csv).toContain('SWI R0, 32'); // C[0][0]
      expect(result.csv).toContain('SWI R0, 36'); // C[0][1]
      expect(result.csv).toContain('SWI R0, 40'); // C[1][0]
      expect(result.csv).toContain('SWI R0, 44'); // C[1][1]

      expect(result.suggestedGridSize).toEqual({ width: 2, height: 2 });
    });

    it('should execute 2x2 matrix multiplication and produce correct output values', () => {
      // Matrix multiplication test with simulation:
      // A = [[1, 2], [3, 4]]
      // B = [[5, 6], [7, 8]]
      // C = A * B = [[19, 22], [43, 50]]
      const code = `
.data2d A[2][2] { 1, 2, 3, 4 }
.data2d B[2][2] { 5, 6, 7, 8 }
.data2d C[2][2]

kernel "MatMul2x2_Simulation" {
    config(0xF, 0);

    #pragma parallel collapse(2)
    for i in range(2) {
        for j in range(2) {
            // Initialize accumulator
            cycle { @j,i: SADD R0, ZERO, ZERO; }

            // k=0: R1=A[i][0], R2=B[0][j], R3=R1*R2, R0+=R3
            cycle { @j,i: LWI R1, A[i][0]; }
            cycle { @j,i: LWI R2, B[0][j]; }
            cycle { @j,i: SMUL R3, R1, R2; }
            cycle { @j,i: SADD R0, R0, R3; }

            // k=1: R1=A[i][1], R2=B[1][j], R3=R1*R2, R0+=R3
            cycle { @j,i: LWI R1, A[i][1]; }
            cycle { @j,i: LWI R2, B[1][j]; }
            cycle { @j,i: SMUL R3, R1, R2; }
            cycle { @j,i: SADD R0, R0, R3; }

            // Store result to C[i][j]
            cycle { @j,i: SWI R0, C[i][j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
`;
      // 1. Compile DSL to CSV
      const compileResult = compileDslToCsv(code);
      expect(compileResult.success).toBe(true);
      expect(compileResult.csv).toBeDefined();

      // 2. Parse CSV to CycleProgram[]
      // Note: CSV is generated with default 4x4 grid format
      const gridConfig = { width: 4, height: 4 };
      const program = parseProgram(compileResult.csv!, gridConfig);

      // 3. Convert memoryInit Map to MemoryRegion[]
      const memoryRegions: MemoryRegion[] = [];
      if (compileResult.memoryInit) {
        for (const [address, values] of compileResult.memoryInit) {
          memoryRegions.push({ start: address, values: [...values] });
        }
      }

      // 4. Run simulation
      const simResult = runSimulation({
        program,
        gridConfig,
        memoryRegions,
        limit: 50
      });

      // 5. Get final memory state
      const finalState = simResult.state[simResult.state.length - 1];
      expect(finalState).toBeDefined();

      // 6. Verify C matrix values in memory
      // NOTE: The simulator stores memory as a packed word array.
      // Byte addresses in LWI/SWI are converted to word indices via (addr >>> 2).
      // A starts at byte 0  -> word idx 0:  A[0..3] at memory[0..3]
      // B starts at byte 16 -> word idx 4:  B[0..3] at memory[4..7]
      // C starts at byte 32 -> word idx 8:  C[0..3] at memory[8..11]
      const memory = finalState.memory;

      // Expected results: C = [[19, 22], [43, 50]]
      expect(memory[8]).toBe(19);   // C[0][0] at byte 32
      expect(memory[9]).toBe(22);   // C[0][1] at byte 36
      expect(memory[10]).toBe(43);  // C[1][0] at byte 40
      expect(memory[11]).toBe(50);  // C[1][1] at byte 44
    });
  });

  describe('Complex 2D Index Expressions', () => {
    it('should support M[i+1][j] offset expressions', () => {
      const code = `
.data2d M[4][4] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 }

kernel "Test2D_Offset" {
    config(0xF, 0);

    for i in range(3) {
        cycle { @0,0: LWI R0, M[i+1][0]; }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);
      // M[i+1][0] for i=0,1,2 should be M[1][0], M[2][0], M[3][0]
      // These are at linear indices 4, 8, 12 → addresses 16, 32, 48
      expect(result.csv).toContain('LWI R0, 16'); // M[1][0] = index 4 * 4 bytes
      expect(result.csv).toContain('LWI R0, 32'); // M[2][0] = index 8 * 4 bytes
      expect(result.csv).toContain('LWI R0, 48'); // M[3][0] = index 12 * 4 bytes
    });

    it('should support M[i-1][j] negative offset expressions', () => {
      const code = `
.data2d M[4][4] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 }

kernel "Test2D_NegOffset" {
    config(0xF, 0);

    for i in range(1, 4) {
        cycle { @0,0: LWI R0, M[i-1][0]; }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);
      // M[i-1][0] for i=1,2,3 should be M[0][0], M[1][0], M[2][0]
      // These are at linear indices 0, 4, 8 → addresses 0, 16, 32
      expect(result.csv).toContain('LWI R0, 0');  // M[0][0]
      expect(result.csv).toContain('LWI R0, 16'); // M[1][0]
      expect(result.csv).toContain('LWI R0, 32'); // M[2][0]
    });

    it('should support M[i][j+1] column offset', () => {
      const code = `
.data2d M[3][3] { 1, 2, 3, 4, 5, 6, 7, 8, 9 }

kernel "Test2D_ColOffset" {
    config(0xF, 0);

    for j in range(2) {
        cycle { @0,0: LWI R0, M[0][j+1]; }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);
      // M[0][j+1] for j=0,1 should be M[0][1], M[0][2]
      // Linear indices 1, 2 → addresses 4, 8
      expect(result.csv).toContain('LWI R0, 4'); // M[0][1]
      expect(result.csv).toContain('LWI R0, 8'); // M[0][2]
    });

    it('should support nested loops with complex expressions for stencil access', () => {
      // Stencil pattern: access 5-point neighborhood
      const code = `
.data2d image[4][4] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 }

kernel "Test2D_Stencil" {
    config(0xF, 0);

    for i in range(1, 3) {
        for j in range(1, 3) {
            // Load 5-point stencil neighbors
            cycle { @0,0: LWI R0, image[i-1][j]; }   // Top
            cycle { @0,0: LWI R1, image[i+1][j]; }   // Bottom
            cycle { @0,0: LWI R2, image[i][j-1]; }   // Left
            cycle { @0,0: LWI R3, image[i][j+1]; }   // Right
        }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);

      // For i=1, j=1 (center at index 5):
      // Top: M[0][1] = index 1 → addr 4
      // Bottom: M[2][1] = index 9 → addr 36
      // Left: M[1][0] = index 4 → addr 16
      // Right: M[1][2] = index 6 → addr 24

      // For i=1, j=2:
      // Top: M[0][2] = index 2 → addr 8
      // Bottom: M[2][2] = index 10 → addr 40
      // Left: M[1][1] = index 5 → addr 20
      // Right: M[1][3] = index 7 → addr 28

      expect(result.csv).toContain('LWI R0, 4');  // M[0][1]
      expect(result.csv).toContain('LWI R1, 36'); // M[2][1]
      expect(result.csv).toContain('LWI R2, 16'); // M[1][0]
      expect(result.csv).toContain('LWI R3, 24'); // M[1][2]
    });

    it('should support multiplication in index expressions', () => {
      const code = `
.data2d M[4][4] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 }

kernel "Test2D_MulExpr" {
    config(0xF, 0);

    for i in range(2) {
        cycle { @0,0: LWI R0, M[i*2][0]; }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);
      // M[i*2][0] for i=0,1 should be M[0][0], M[2][0]
      // Linear indices 0, 8 → addresses 0, 32
      expect(result.csv).toContain('LWI R0, 0');  // M[0][0]
      expect(result.csv).toContain('LWI R0, 32'); // M[2][0]
    });

    it('should support both row and col expressions in same access', () => {
      const code = `
.data2d M[4][4] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 }

kernel "Test2D_BothExpr" {
    config(0xF, 0);

    for i in range(1, 3) {
        for j in range(1, 3) {
            // Diagonal neighbor access
            cycle { @0,0: LWI R0, M[i-1][j-1]; }
        }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);
      // M[i-1][j-1] for (i,j) = (1,1), (1,2), (2,1), (2,2)
      // Gives M[0][0], M[0][1], M[1][0], M[1][1]
      // Linear indices 0, 1, 4, 5 → addresses 0, 4, 16, 20
      expect(result.csv).toContain('LWI R0, 0');  // M[0][0]
      expect(result.csv).toContain('LWI R0, 4');  // M[0][1]
      expect(result.csv).toContain('LWI R0, 16'); // M[1][0]
      expect(result.csv).toContain('LWI R0, 20'); // M[1][1]
    });

    it('should work with 1D arrays too', () => {
      const code = `
.data values { 10, 20, 30, 40, 50 }

kernel "Test1D_Expr" {
    config(0xF, 0);

    for i in range(4) {
        cycle { @0,0: LWI R0, values[i+1]; }
    }

    cycle { @0,0: EXIT; }
}
`;
      const result = compileDslToCsv(code);
      if (!result.success) {
        console.log('Error:', result.error, 'Line:', result.line);
      }
      expect(result.success).toBe(true);
      // values[i+1] for i=0,1,2,3 should be values[1,2,3,4]
      // Addresses: 4, 8, 12, 16
      expect(result.csv).toContain('LWI R0, 4');  // values[1]
      expect(result.csv).toContain('LWI R0, 8');  // values[2]
      expect(result.csv).toContain('LWI R0, 12'); // values[3]
      expect(result.csv).toContain('LWI R0, 16'); // values[4]
    });
  });
});
