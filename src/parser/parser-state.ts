/**
 * OpenEdge-DSL Parser State
 *
 * Manages the state during parsing including AST construction and symbol table.
 */

import {
  KernelAst,
  CycleBlock,
  Instruction,
  Assertion,
  PragmaDirective
} from '../types/ast';
import {
  SymbolTable,
  NamedArray,
  FunctionDefinition,
  createSymbolTable
} from '../types/symbols';
import { Token } from '../types/tokens';

/**
 * Parser state during AST construction
 */
export interface ParserState {
  /** The AST being built */
  ast: KernelAst;
  /** Symbol table for names resolution */
  symbols: SymbolTable;
  /** Current cycle counter */
  cycleCounter: number;
  /** Next free memory address for auto-allocation */
  nextFreeAddress: number;
  /** Global data index for flattened array access */
  globalDataIndex: number;
  /** Active pragma directive (if any) */
  activePragma: PragmaDirective | null;
}

/**
 * Creates initial parser state
 */
export function createParserState(): ParserState {
  return {
    ast: createEmptyAst(),
    symbols: createSymbolTable(),
    cycleCounter: 0,
    nextFreeAddress: 0,
    globalDataIndex: 0,
    activePragma: null
  };
}

/**
 * Creates an empty AST structure
 */
export function createEmptyAst(): KernelAst {
  return {
    name: 'Untitled',
    config: { mask: 0xF, startAddr: 0 },
    cycles: [],
    memoryInit: new Map(),
    ioConfig: {
      loadAddrs: [],
      storeAddrs: []
    },
    assertions: []
  };
}

/**
 * Creates a new cycle block
 */
export function createCycleBlock(cycleNumber: number, label?: string): CycleBlock {
  return {
    cycleNumber,
    label,
    instructions: new Map()
  };
}

/**
 * Creates an instruction
 */
export function createInstruction(
  opcode: string,
  operands: string[],
  originalLine: number
): Instruction {
  return { opcode, operands, originalLine };
}

/**
 * Adds a cycle to the AST
 */
export function addCycle(state: ParserState, cycle: CycleBlock): void {
  state.ast.cycles.push(cycle);
}

/**
 * Registers a constant in the symbol table
 */
export function registerConstant(state: ParserState, name: string, value: string): void {
  state.symbols.constants.set(name, value);
}

/**
 * Registers an alias in the symbol table
 */
export function registerAlias(state: ParserState, name: string, register: string): void {
  state.symbols.aliases.set(name, register);
}

/**
 * Registers a label in the symbol table
 */
export function registerLabel(state: ParserState, name: string, cycleNumber: number): void {
  state.symbols.labels.set(name, cycleNumber);
}

/**
 * Registers a function definition
 */
export function registerFunction(
  state: ParserState,
  name: string,
  params: string[],
  tokens: Token[]
): void {
  state.symbols.functions.set(name, { params, tokens });
}

/**
 * Registers a named array and updates memory allocation
 */
export function registerNamedArray(
  state: ParserState,
  name: string,
  address: number,
  values: number[]
): void {
  // Store in memory init
  state.ast.memoryInit.set(address, values);

  // Register in symbol table
  const namedArray: NamedArray = {
    name,
    baseAddress: address,
    length: values.length,
    globalStartIndex: state.globalDataIndex
  };
  state.symbols.namedArrays.set(name, namedArray);

  // Update counters
  state.globalDataIndex += values.length;
  const blockSize = values.length * 4;
  if (address + blockSize > state.nextFreeAddress) {
    state.nextFreeAddress = address + blockSize;
  }
}

/**
 * Registers anonymous data (without a name)
 */
export function registerAnonymousData(
  state: ParserState,
  address: number,
  values: number[]
): void {
  state.ast.memoryInit.set(address, values);

  state.globalDataIndex += values.length;
  const blockSize = values.length * 4;
  if (address + blockSize > state.nextFreeAddress) {
    state.nextFreeAddress = address + blockSize;
  }
}

/**
 * Registers a 2D named array and updates memory allocation
 */
export function registerNamedArray2D(
  state: ParserState,
  name: string,
  address: number,
  values: number[],
  rows: number,
  cols: number
): void {
  // Store in memory init
  state.ast.memoryInit.set(address, values);

  // Register in symbol table with 2D info
  const namedArray: NamedArray = {
    name,
    baseAddress: address,
    length: values.length,
    globalStartIndex: state.globalDataIndex,
    is2D: true,
    rows,
    cols
  };
  state.symbols.namedArrays.set(name, namedArray);

  // Update counters
  state.globalDataIndex += values.length;
  const blockSize = values.length * 4;
  if (address + blockSize > state.nextFreeAddress) {
    state.nextFreeAddress = address + blockSize;
  }
}

/**
 * Sets IO load addresses
 */
export function setIoLoadAddrs(state: ParserState, addrs: number[]): void {
  state.ast.ioConfig.loadAddrs = addrs;
}

/**
 * Sets IO store addresses
 */
export function setIoStoreAddrs(state: ParserState, addrs: number[]): void {
  state.ast.ioConfig.storeAddrs = addrs;
}

/**
 * Sets the cycle limit
 */
export function setCycleLimit(state: ParserState, limit: number): void {
  state.ast.maxCycles = limit;
}

/**
 * Sets the kernel name
 */
export function setKernelName(state: ParserState, name: string): void {
  state.ast.name = name;
}

/**
 * Sets the kernel config
 */
export function setKernelConfig(state: ParserState, mask: number, startAddr: number): void {
  state.ast.config.mask = mask;
  state.ast.config.startAddr = startAddr;
}

/**
 * Adds an assertion
 */
export function addAssertion(state: ParserState, assertion: Assertion): void {
  state.ast.assertions.push(assertion);
}

/**
 * Sets the active pragma
 */
export function setActivePragma(state: ParserState, pragma: PragmaDirective | null): void {
  state.activePragma = pragma;
}

/**
 * Consumes and returns the active pragma, clearing it
 */
export function consumeActivePragma(state: ParserState): PragmaDirective | null {
  const pragma = state.activePragma;
  state.activePragma = null;
  return pragma;
}

/**
 * Gets the next cycle number and increments the counter
 */
export function nextCycleNumber(state: ParserState): number {
  return state.cycleCounter++;
}

/**
 * Gets the current cycle number without incrementing
 */
export function currentCycleNumber(state: ParserState): number {
  return state.cycleCounter;
}

/**
 * Allocates memory at the next free address
 */
export function allocateMemory(state: ParserState, size: number): number {
  const address = state.nextFreeAddress;
  state.nextFreeAddress += size;
  return address;
}

/**
 * Resolves a named array from the symbol table
 */
export function resolveNamedArray(state: ParserState, name: string): NamedArray | undefined {
  return state.symbols.namedArrays.get(name);
}

/**
 * Resolves a function from the symbol table
 */
export function resolveFunction(state: ParserState, name: string): FunctionDefinition | undefined {
  return state.symbols.functions.get(name);
}

/**
 * Resolves a constant from the symbol table
 */
export function resolveConstant(state: ParserState, name: string): string | undefined {
  return state.symbols.constants.get(name);
}

/**
 * Resolves an alias from the symbol table
 */
export function resolveAlias(state: ParserState, name: string): string | undefined {
  return state.symbols.aliases.get(name);
}

/**
 * Resolves a label from the symbol table
 */
export function resolveLabel(state: ParserState, name: string): number | undefined {
  return state.symbols.labels.get(name);
}
