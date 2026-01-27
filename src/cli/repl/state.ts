/**
 * REPL State Manager
 * 
 * Manages the simulated CGRA state including:
 * - Register values per PE (R0-R3 + ROUT per ISA)
 * - Memory contents
 * - Cycle counter
 * - Data declarations
 * 
 * Based on OpenEdgeCGRA-ISA v2.0.1:
 * - RC_NUM_REG = 4 (R0, R1, R2, R3)
 * - ROUT: Output register (always receives ALU result except NOP)
 * - Operand sources: ZERO, SELF, RCL, RCR, RCT, RCB, R0-R3, IMM
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface RegisterFile {
  R0: number;
  R1: number;
  R2: number;
  R3: number;
  ROUT: number;  // Output register - connected to neighbors
}

// Flags: [sign, zero] as per ISA
export interface Flags {
  sign: boolean;  // flag[1] = bit 31 of result (1 if negative)
  zero: boolean;  // flag[0] = NOR of all bits (1 if result = 0)
}

export interface PE {
  row: number;
  col: number;
  registers: RegisterFile;
  flags: Flags;           // Current flags (from last ALU operation)
  lastModified?: string;  // Track which register was last modified
}

export interface MemoryRegion {
  name: string;
  address: number;
  values: number[];
}

export interface DataDeclaration {
  name: string;
  address: number;
  values: number[];
}

export interface ReplState {
  // Grid of PEs (4x4 default)
  grid: PE[][];
  gridWidth: number;
  gridHeight: number;
  
  // Memory
  memory: Map<number, number>;
  memoryRegions: MemoryRegion[];
  
  // Data declarations
  data: Map<string, DataDeclaration>;
  
  // Execution state
  cycle: number;
  history: string[];
  lastError?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE FACTORY
// ═══════════════════════════════════════════════════════════════════════════

function createRegisterFile(): RegisterFile {
  return {
    R0: 0, R1: 0, R2: 0, R3: 0,
    ROUT: 0,
  };
}

function createFlags(): Flags {
  return { sign: false, zero: true };  // Initial: result is 0
}

function createPE(row: number, col: number): PE {
  return {
    row,
    col,
    registers: createRegisterFile(),
    flags: createFlags(),
  };
}

export function createInitialState(width: number = 4, height: number = 4): ReplState {
  const grid: PE[][] = [];
  
  for (let row = 0; row < height; row++) {
    grid[row] = [];
    for (let col = 0; col < width; col++) {
      grid[row][col] = createPE(row, col);
    }
  }
  
  return {
    grid,
    gridWidth: width,
    gridHeight: height,
    memory: new Map(),
    memoryRegions: [],
    data: new Map(),
    cycle: 0,
    history: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export function resetState(state: ReplState): void {
  // Reset all registers and flags
  for (let row = 0; row < state.gridHeight; row++) {
    for (let col = 0; col < state.gridWidth; col++) {
      state.grid[row][col].registers = createRegisterFile();
      state.grid[row][col].flags = createFlags();
      state.grid[row][col].lastModified = undefined;
    }
  }
  
  // Reset memory but keep structure
  state.memory.clear();
  
  // Reload data declarations into memory
  for (const [_, decl] of state.data) {
    for (let i = 0; i < decl.values.length; i++) {
      state.memory.set(decl.address + i, decl.values[i]);
    }
  }
  
  // Reset execution state
  state.cycle = 0;
  state.history = [];
  state.lastError = undefined;
}

export function getPE(state: ReplState, row: number, col: number): PE | null {
  if (row < 0 || row >= state.gridHeight || col < 0 || col >= state.gridWidth) {
    return null;
  }
  return state.grid[row][col];
}

// Toroidal mesh - get neighbors with wraparound
export function getNeighborPE(state: ReplState, row: number, col: number, direction: 'L' | 'R' | 'T' | 'B'): PE {
  const h = state.gridHeight;
  const w = state.gridWidth;
  
  switch (direction) {
    case 'L': return state.grid[row][(col - 1 + w) % w];  // Left (West)
    case 'R': return state.grid[row][(col + 1) % w];      // Right (East)
    case 'T': return state.grid[(row - 1 + h) % h][col];  // Top (North)
    case 'B': return state.grid[(row + 1) % h][col];      // Bottom (South)
  }
}

// Get neighbor's ROUT value (from previous cycle, as per ISA)
export function getNeighborROUT(state: ReplState, row: number, col: number, direction: 'SELF' | 'RCL' | 'RCR' | 'RCT' | 'RCB'): number {
  if (direction === 'SELF') {
    return state.grid[row][col].registers.ROUT;
  }
  
  const dirMap: Record<string, 'L' | 'R' | 'T' | 'B'> = {
    'RCL': 'L', 'RCR': 'R', 'RCT': 'T', 'RCB': 'B'
  };
  
  const neighbor = getNeighborPE(state, row, col, dirMap[direction]);
  return neighbor.registers.ROUT;
}

// Update flags based on result (as per ISA: flag = {sign, zero})
export function updateFlags(pe: PE, result: number): void {
  // Treat as 32-bit signed
  const sign32 = (result & 0x80000000) !== 0;  // Bit 31
  const isZero = (result & 0xFFFFFFFF) === 0;
  
  pe.flags = { sign: sign32, zero: isZero };
}

export function getRegister(state: ReplState, row: number, col: number, reg: string): number | null {
  const pe = getPE(state, row, col);
  if (!pe) return null;
  
  const regName = reg.toUpperCase() as keyof RegisterFile;
  if (regName in pe.registers) {
    return pe.registers[regName];
  }
  
  // Special registers
  if (reg === 'ZERO') return 0;
  if (reg === 'IMM') return 0; // Placeholder
  
  return null;
}

export function setRegister(state: ReplState, row: number, col: number, reg: string, value: number): boolean {
  const pe = getPE(state, row, col);
  if (!pe) return false;
  
  const regName = reg.toUpperCase() as keyof RegisterFile;
  if (regName in pe.registers) {
    pe.registers[regName] = value;
    pe.lastModified = regName;
    return true;
  }
  
  return false;
}

export function readMemory(state: ReplState, address: number): number {
  return state.memory.get(address) ?? 0;
}

export function writeMemory(state: ReplState, address: number, value: number): void {
  state.memory.set(address, value);
}

export function declareData(state: ReplState, name: string, address: number, values: number[]): void {
  const decl: DataDeclaration = { name, address, values };
  state.data.set(name, decl);
  
  // Write to memory
  for (let i = 0; i < values.length; i++) {
    state.memory.set(address + i, values[i]);
  }
  
  // Track as memory region
  state.memoryRegions.push({
    name,
    address,
    values: [...values],
  });
}

export function resolveDataAddress(state: ReplState, name: string, index: number = 0): number | null {
  const decl = state.data.get(name);
  if (!decl) return null;
  return decl.address + index;
}

export function incrementCycle(state: ReplState): void {
  state.cycle++;
}

export function addHistory(state: ReplState, command: string): void {
  state.history.push(command);
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

export function formatRegisterFile(regs: RegisterFile): string {
  const parts = [];
  for (const [name, value] of Object.entries(regs)) {
    if (value !== 0) {
      parts.push(`${name}=${value}`);
    }
  }
  return parts.length > 0 ? parts.join(' ') : '(all zero)';
}

export function formatPEState(pe: PE): string {
  return `PE[${pe.row},${pe.col}]: ${formatRegisterFile(pe.registers)}`;
}

export function formatMemoryRegion(state: ReplState, name: string): string | null {
  const decl = state.data.get(name);
  if (!decl) return null;
  
  const currentValues: number[] = [];
  for (let i = 0; i < decl.values.length; i++) {
    currentValues.push(readMemory(state, decl.address + i));
  }
  
  return `${name} @ 0x${decl.address.toString(16)}: [${currentValues.join(', ')}]`;
}

export function getStateSnapshot(state: ReplState): {
  cycle: number;
  activePEs: { row: number; col: number; registers: RegisterFile }[];
  memory: { name: string; address: number; values: number[] }[];
} {
  const activePEs: { row: number; col: number; registers: RegisterFile }[] = [];
  
  for (let row = 0; row < state.gridHeight; row++) {
    for (let col = 0; col < state.gridWidth; col++) {
      const pe = state.grid[row][col];
      const hasNonZero = Object.values(pe.registers).some(v => v !== 0);
      if (hasNonZero) {
        activePEs.push({
          row: pe.row,
          col: pe.col,
          registers: { ...pe.registers },
        });
      }
    }
  }
  
  const memory: { name: string; address: number; values: number[] }[] = [];
  for (const [name, decl] of state.data) {
    const currentValues: number[] = [];
    for (let i = 0; i < decl.values.length; i++) {
      currentValues.push(readMemory(state, decl.address + i));
    }
    memory.push({ name, address: decl.address, values: currentValues });
  }
  
  return { cycle: state.cycle, activePEs, memory };
}
