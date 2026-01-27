/**
 * Project and Kernel Templates
 * 
 * Templates for scaffolding new OpenEdge DSL projects and kernels.
 */

export interface ProjectTemplate {
  name: string;
  description: string;
  files: { path: string; content: string }[];
}

export interface KernelTemplate {
  name: string;
  description: string;
  content: string;
}

// ============================================================
// Project Templates
// ============================================================

export const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  basic: {
    name: 'Basic Project',
    description: 'Simple project with one kernel',
    files: [
      {
        path: 'src/main.dsl',
        content: `// Main kernel
// Edit this file to define your CGRA program

.data input @ 0x100 = [1, 2, 3, 4]
.data output @ 0x200 = [0, 0, 0, 0]

.io_load = [0x100]
.io_store = [0x200]

kernel "Main" {
  config(0xF, 0);
  
  // Load data
  cycle {
    @0,0: LWI R0, input[0];
    @0,1: LWI R1, input[1];
    @0,2: LWI R2, input[2];
    @0,3: LWI R3, input[3];
  }
  
  // Process (add 1 to each)
  cycle {
    @0,0: ADD R0, R0, R4;  // R4 = 1 (set via config)
    @0,1: ADD R1, R1, R4;
    @0,2: ADD R2, R2, R4;
    @0,3: ADD R3, R3, R4;
  }
  
  // Store results
  cycle {
    @0,0: SWI R0, output[0];
    @0,1: SWI R1, output[1];
    @0,2: SWI R2, output[2];
    @0,3: SWI R3, output[3];
  }
}
`,
      },
      {
        path: '.openedge.json',
        content: `{
  "name": "my-project",
  "version": "0.1.0",
  "main": "src/main.dsl",
  "output": "build/",
  "grid": {
    "width": 4,
    "height": 4
  },
  "options": {
    "optimize": true,
    "verbose": false
  }
}
`,
      },
      {
        path: '.gitignore',
        content: `# Build output
build/
*.csv

# Editor
.vscode/
*.swp
*~

# OS
.DS_Store
Thumbs.db
`,
      },
      {
        path: 'README.md',
        content: `# My OpenEdge Project

## Getting Started

\`\`\`bash
# Compile
openedge compile src/main.dsl

# Watch mode
openedge watch src/main.dsl -dm

# Launch TUI
openedge tui
\`\`\`

## Project Structure

\`\`\`
src/
  main.dsl      # Main kernel
build/
  main.csv      # Compiled output
\`\`\`
`,
      },
    ],
  },

  advanced: {
    name: 'Advanced Project',
    description: 'Multi-kernel project with functions and tests',
    files: [
      {
        path: 'src/main.dsl',
        content: `// Main kernel - imports helper functions
// This project demonstrates modular kernel design

.const GRID_SIZE = 4
.const DATA_SIZE = 16

.data input @ 0x000 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
.data output @ 0x100 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

.io_load = [0x000]
.io_store = [0x100]

// Reusable function to load a row
function loadRow(row, baseAddr) {
  @row,0: LWI R0, baseAddr[row * 4 + 0];
  @row,1: LWI R1, baseAddr[row * 4 + 1];
  @row,2: LWI R2, baseAddr[row * 4 + 2];
  @row,3: LWI R3, baseAddr[row * 4 + 3];
}

// Reusable function to store a row
function storeRow(row, baseAddr) {
  @row,0: SWI R0, baseAddr[row * 4 + 0];
  @row,1: SWI R1, baseAddr[row * 4 + 1];
  @row,2: SWI R2, baseAddr[row * 4 + 2];
  @row,3: SWI R3, baseAddr[row * 4 + 3];
}

kernel "ProcessGrid" {
  config(0xFFFF, 0);
  
  // Load all rows in parallel
  #pragma parallel
  for row in range(0, GRID_SIZE) {
    cycle {
      loadRow(row, input)
    }
  }
  
  // Process: double each value
  cycle {
    row 0..3, col 0..3: ADD R0, R0, R0;
  }
  
  // Store all rows
  #pragma parallel
  for row in range(0, GRID_SIZE) {
    cycle {
      storeRow(row, output)
    }
  }
}
`,
      },
      {
        path: 'src/utils.dsl',
        content: `// Utility functions for common patterns

// Vector dot product (4 elements)
function dotProduct4(a0, a1, a2, a3, b0, b1, b2, b3, result) {
  @0,0: MUL R4, a0, b0;
  @0,1: MUL R5, a1, b1;
  @0,2: MUL R6, a2, b2;
  @0,3: MUL R7, a3, b3;
  
  @0,0: ADD R4, R4, R5;
  @0,2: ADD R6, R6, R7;
  @0,0: ADD result, R4, R6;
}

// Reduction sum across row
function reduceRow(row, srcReg, dstReg) {
  #pragma reduce(ADD, srcReg, dstReg)
}
`,
      },
      {
        path: 'tests/test_main.dsl',
        content: `// Test for main kernel

.data test_input @ 0x000 = [1, 2, 3, 4]
.data test_output @ 0x100 = [0, 0, 0, 0]
.data expected @ 0x200 = [2, 4, 6, 8]

.assert output[0] == expected[0]
.assert output[1] == expected[1]
.assert output[2] == expected[2]
.assert output[3] == expected[3]

kernel "TestDouble" {
  config(0xF, 0);
  
  cycle {
    @0,0: LWI R0, test_input[0];
    @0,1: LWI R1, test_input[1];
    @0,2: LWI R2, test_input[2];
    @0,3: LWI R3, test_input[3];
  }
  
  cycle {
    @0,0: ADD R0, R0, R0;
    @0,1: ADD R1, R1, R1;
    @0,2: ADD R2, R2, R2;
    @0,3: ADD R3, R3, R3;
  }
  
  cycle {
    @0,0: SWI R0, test_output[0];
    @0,1: SWI R1, test_output[1];
    @0,2: SWI R2, test_output[2];
    @0,3: SWI R3, test_output[3];
  }
}
`,
      },
      {
        path: '.openedge.json',
        content: `{
  "name": "advanced-project",
  "version": "0.1.0",
  "main": "src/main.dsl",
  "output": "build/",
  "grid": {
    "width": 4,
    "height": 4
  },
  "include": ["src/"],
  "tests": "tests/",
  "options": {
    "optimize": true,
    "verbose": false
  }
}
`,
      },
      {
        path: '.gitignore',
        content: `build/
*.csv
.vscode/
.DS_Store
`,
      },
      {
        path: 'README.md',
        content: `# Advanced OpenEdge Project

Multi-kernel project with reusable functions and tests.

## Structure

\`\`\`
src/
  main.dsl      # Main kernel
  utils.dsl     # Reusable functions
tests/
  test_main.dsl # Test kernels
build/
  *.csv         # Compiled output
\`\`\`

## Commands

\`\`\`bash
# Compile main
openedge compile src/main.dsl -o build/main.csv

# Run tests
openedge check tests/test_main.dsl

# Watch with metrics
openedge watch src/main.dsl -dm
\`\`\`
`,
      },
    ],
  },

  zkp: {
    name: 'ZKP Cryptography',
    description: 'Zero-Knowledge Proof arithmetic operations',
    files: [
      {
        path: 'src/field_ops.dsl',
        content: `// Finite Field Arithmetic for ZK Proofs
// Montgomery multiplication and modular operations

.const PRIME_BITS = 256
.const LIMB_SIZE = 32

// Prime modulus (example: BN254 curve order)
.data prime @ 0x000 = [
  0x30644e72, 0xe131a029, 0xb85045b6, 0x8181585d,
  0x97816a91, 0x6871ca8d, 0x3c208c16, 0xd87cfd47
]

// Montgomery R^2 mod p
.data r_squared @ 0x100 = [
  0x06d89f71, 0xcab8351f, 0x47ab1eff, 0x0a417ff6,
  0x9ec67e12, 0x84a1ed45, 0xf729d9dc, 0xdb56c931
]

.data input_a @ 0x200 = [0, 0, 0, 0, 0, 0, 0, 0]
.data input_b @ 0x280 = [0, 0, 0, 0, 0, 0, 0, 0]
.data output @ 0x300 = [0, 0, 0, 0, 0, 0, 0, 0]

.io_load = [0x200, 0x280]
.io_store = [0x300]

// Montgomery multiplication: a * b * R^-1 mod p
kernel "MontMul" {
  config(0xFFFF, 0);
  
  // Load operands into registers
  cycle {
    row 0: LWI R0, input_a[col];
    row 1: LWI R0, input_b[col];
  }
  
  // Perform multiplication (simplified - real impl needs carry chain)
  #pragma unroll(8)
  for i in range(0, 8) {
    cycle {
      row 0, col i: MUL R1, R0, R0;  // Partial product
    }
  }
  
  // Reduction step
  cycle {
    row 0: ADD R0, R0, R1;
  }
  
  // Store result
  cycle {
    row 0: SWI R0, output[col];
  }
}
`,
      },
      {
        path: 'src/poseidon.dsl',
        content: `// Poseidon Hash Function for ZK circuits
// Sponge construction with S-box operations

.const WIDTH = 3      // Sponge width (t)
.const RATE = 2       // Rate
.const FULL_ROUNDS = 8
.const PARTIAL_ROUNDS = 56

// Round constants (truncated for example)
.data round_constants @ 0x400 = [
  0x0ee9a592, 0x09af4f72, 0xab0f9b96, 0x00000001,
  0x00000002, 0x00000003, 0x00000004, 0x00000005
]

// State
.data state @ 0x500 = [0, 0, 0]
.data output @ 0x600 = [0]

kernel "PoseidonHash" {
  config(0x7, 0);  // 3 PEs for width=3
  
  // Initialize state with input
  cycle {
    @0,0: LWI R0, state[0];
    @0,1: LWI R0, state[1];
    @0,2: LWI R0, state[2];
  }
  
  // Full rounds
  #pragma unroll(4)
  for r in range(0, FULL_ROUNDS) {
    // Add round constant
    cycle {
      @0,0: LWI R1, round_constants[r * 3 + 0];
      @0,1: LWI R1, round_constants[r * 3 + 1];
      @0,2: LWI R1, round_constants[r * 3 + 2];
    }
    cycle {
      row 0: ADD R0, R0, R1;
    }
    
    // S-box: x^5
    cycle {
      row 0: MUL R1, R0, R0;   // x^2
    }
    cycle {
      row 0: MUL R1, R1, R1;   // x^4
    }
    cycle {
      row 0: MUL R0, R0, R1;   // x^5
    }
  }
  
  // Output first element as hash
  cycle {
    @0,0: SWI R0, output[0];
  }
}
`,
      },
      {
        path: '.openedge.json',
        content: `{
  "name": "zkp-project",
  "version": "0.1.0",
  "description": "Zero-Knowledge Proof cryptographic operations",
  "main": "src/field_ops.dsl",
  "output": "build/",
  "grid": {
    "width": 8,
    "height": 4
  },
  "options": {
    "optimize": true,
    "verbose": false
  }
}
`,
      },
      {
        path: '.gitignore',
        content: `build/
*.csv
.vscode/
.DS_Store
`,
      },
      {
        path: 'README.md',
        content: `# ZKP Cryptography Project

CGRA implementations of Zero-Knowledge Proof primitives.

## Kernels

- **MontMul**: Montgomery multiplication for finite field arithmetic
- **PoseidonHash**: Poseidon hash function for ZK circuits

## Usage

\`\`\`bash
# Compile field operations
openedge compile src/field_ops.dsl -o build/field_ops.csv

# Compile Poseidon hash
openedge compile src/poseidon.dsl -o build/poseidon.csv

# View in TUI
openedge tui
\`\`\`
`,
      },
    ],
  },
};

// ============================================================
// Kernel Templates
// ============================================================

export const KERNEL_TEMPLATES: Record<string, KernelTemplate> = {
  simple: {
    name: 'Simple Kernel',
    description: 'Basic load-compute-store pattern',
    content: `// Simple kernel template
// Load data, process, store results

.data input @ 0x100 = [1, 2, 3, 4]
.data output @ 0x200 = [0, 0, 0, 0]

.io_load = [0x100]
.io_store = [0x200]

kernel "{{NAME}}" {
  config(0xF, 0);
  
  // Load
  cycle {
    @0,0: LWI R0, input[0];
    @0,1: LWI R1, input[1];
    @0,2: LWI R2, input[2];
    @0,3: LWI R3, input[3];
  }
  
  // Compute
  cycle {
    @0,0: ADD R0, R0, R0;
    @0,1: ADD R1, R1, R1;
    @0,2: ADD R2, R2, R2;
    @0,3: ADD R3, R3, R3;
  }
  
  // Store
  cycle {
    @0,0: SWI R0, output[0];
    @0,1: SWI R1, output[1];
    @0,2: SWI R2, output[2];
    @0,3: SWI R3, output[3];
  }
}
`,
  },

  matrix: {
    name: 'Matrix Operations',
    description: 'Matrix multiplication pattern',
    content: `// Matrix multiplication kernel
// C = A * B (4x4 matrices)

.const SIZE = 4

.data matA @ 0x000 = [
  1, 2, 3, 4,
  5, 6, 7, 8,
  9, 10, 11, 12,
  13, 14, 15, 16
]

.data matB @ 0x100 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]

.data matC @ 0x200 = [
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0
]

.io_load = [0x000, 0x100]
.io_store = [0x200]

kernel "{{NAME}}" {
  config(0xFFFF, 0);
  
  // Each PE computes C[row][col] = sum(A[row][k] * B[k][col])
  #pragma parallel
  for row in range(0, SIZE) {
    for col in range(0, SIZE) {
      // Initialize accumulator
      cycle {
        @row,col: MOVI R7, 0;
      }
      
      // Dot product
      for k in range(0, SIZE) {
        cycle {
          @row,col: LWI R0, matA[row * SIZE + k];
          @row,col: LWI R1, matB[k * SIZE + col];
        }
        cycle {
          @row,col: MUL R2, R0, R1;
        }
        cycle {
          @row,col: ADD R7, R7, R2;
        }
      }
      
      // Store result
      cycle {
        @row,col: SWI R7, matC[row * SIZE + col];
      }
    }
  }
}
`,
  },

  reduction: {
    name: 'Parallel Reduction',
    description: 'Tree reduction pattern (sum, max, etc.)',
    content: `// Parallel reduction kernel
// Computes sum of array using tree reduction

.const SIZE = 16

.data input @ 0x000 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
.data output @ 0x100 = [0]

.io_load = [0x000]
.io_store = [0x100]

kernel "{{NAME}}" {
  config(0xFFFF, 0);
  
  // Load data into PEs (4x4 grid = 16 elements)
  cycle {
    row 0..3, col 0..3: LWI R0, input[row * 4 + col];
  }
  
  // Tree reduction using pragma
  #pragma reduce(ADD, R0, R1)
  
  // Result is in PE(0,0) register R1
  cycle {
    @0,0: SWI R1, output[0];
  }
}
`,
  },

  stencil: {
    name: 'Stencil Pattern',
    description: '2D stencil computation (convolution, blur, etc.)',
    content: `// 2D Stencil kernel
// Applies 3x3 filter to grid

.const WIDTH = 4
.const HEIGHT = 4

// Input grid (with halo for boundaries)
.data grid @ 0x000 = [
  0, 0, 0, 0, 0, 0,
  0, 1, 2, 3, 4, 0,
  0, 5, 6, 7, 8, 0,
  0, 9, 10, 11, 12, 0,
  0, 13, 14, 15, 16, 0,
  0, 0, 0, 0, 0, 0
]

.data output @ 0x200 = [
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0
]

// 3x3 averaging filter (divide by 9 simplified)
.data filter @ 0x300 = [1, 1, 1, 1, 1, 1, 1, 1, 1]

.io_load = [0x000]
.io_store = [0x200]

kernel "{{NAME}}" {
  config(0xFFFF, 0);
  
  // Each PE computes stencil for its position
  #pragma parallel
  for row in range(0, HEIGHT) {
    for col in range(0, WIDTH) {
      // Load center value
      cycle {
        @row,col: LWI R0, grid[(row+1) * 6 + (col+1)];
      }
      
      // Apply cross stencil pattern
      #pragma stencil(cross, ADD, R0, R1)
      
      // Store result
      cycle {
        @row,col: SWI R1, output[row * WIDTH + col];
      }
    }
  }
}
`,
  },

  pipeline: {
    name: 'Data Pipeline',
    description: 'Streaming data through processing stages',
    content: `// Pipeline kernel
// Data flows through multiple processing stages

.const STAGES = 4
.const WIDTH = 4

.data input @ 0x000 = [1, 2, 3, 4, 5, 6, 7, 8]
.data output @ 0x100 = [0, 0, 0, 0, 0, 0, 0, 0]

.io_load = [0x000]
.io_store = [0x100]

kernel "{{NAME}}" {
  config(0xFFFF, 0);
  
  // Stage 0: Load
  // Stage 1: Add 1
  // Stage 2: Multiply by 2
  // Stage 3: Store
  
  // Fill pipeline
  for i in range(0, 8) {
    cycle {
      // Stage 0: Load new data
      @0,0: LWI R0, input[i];
      
      // Stage 1: Process from stage 0
      @1,0: ADD R0, RCL, R4;  // RCL = data from left neighbor
      
      // Stage 2: Process from stage 1
      @2,0: ADD R0, RCL, RCL;  // Multiply by 2
      
      // Stage 3: Store
      @3,0: SWI RCL, output[i];
    }
  }
  
  // Drain pipeline
  for i in range(0, STAGES) {
    cycle {
      @1,0: ADD R0, RCL, R4;
      @2,0: ADD R0, RCL, RCL;
      @3,0: SWI RCL, output[8 + i];
    }
  }
}
`,
  },
};

/**
 * Get list of available project templates
 */
export function getProjectTemplateNames(): string[] {
  return Object.keys(PROJECT_TEMPLATES);
}

/**
 * Get list of available kernel templates
 */
export function getKernelTemplateNames(): string[] {
  return Object.keys(KERNEL_TEMPLATES);
}

/**
 * Get a project template by name
 */
export function getProjectTemplate(name: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES[name];
}

/**
 * Get a kernel template by name
 */
export function getKernelTemplate(name: string): KernelTemplate | undefined {
  return KERNEL_TEMPLATES[name];
}

/**
 * Apply variables to template content
 */
export function applyTemplateVariables(
  content: string, 
  variables: Record<string, string>
): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Generate project files from a template
 */
export function generateProjectFiles(templateId: string, projectName: string): { path: string; content: string }[] {
  const template = PROJECT_TEMPLATES[templateId];
  if (!template) {
    return [];
  }
  
  return template.files.map(file => ({
    path: file.path,
    content: applyTemplateVariables(file.content, { 
      name: projectName,
      projectName: projectName,
    }),
  }));
}

/**
 * Generate kernel file content from a template
 */
export function generateKernelFile(templateId: string, kernelName: string): string {
  const template = KERNEL_TEMPLATES[templateId];
  if (!template) {
    return `// Kernel: ${kernelName}\n// Template not found\n`;
  }
  
  return applyTemplateVariables(template.content, {
    name: kernelName,
    kernelName: kernelName,
  });
}

/**
 * Get list of project templates for UI display
 */
export function getProjectTemplateList(): { id: string; name: string; description: string }[] {
  return Object.entries(PROJECT_TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
  }));
}

/**
 * Get list of kernel templates for UI display
 */
export function getKernelTemplateList(): { id: string; name: string; description: string }[] {
  return Object.entries(KERNEL_TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
  }));
}
