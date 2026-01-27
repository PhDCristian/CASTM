/**
 * REPL State Manager
 * 
 * Manages the simulated CGRA state including:
 * - Register values per PE
 * - Memory contents
 * - Cycle counter
 * - Data declarations
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface RegisterFile {
  R0: number;
  R1: number;
  R2: number;
  R3: number;
  R4: number;
  R5: number;
  R6: number;
  R7: number;
  ROUT: number;
}

export interface PE {
  row: number;
  col: number;
  registers: RegisterFile;
  lastModified?: string; // Track which register was last modified
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
    R4: 0, R5: 0, R6: 0, R7: 0,
    ROUT: 0,
  };
}

function createPE(row: number, col: number): PE {
  return {
    row,
    col,
    registers: createRegisterFile(),
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
  // Reset all registers
  for (let row = 0; row < state.gridHeight; row++) {
    for (let col = 0; col < state.gridWidth; col++) {
      state.grid[row][col].registers = createRegisterFile();
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
