/**
 * OpenEdge-DSL Symbol Table Types
 *
 * Defines types for symbol management during compilation.
 */

import { Token } from './tokens';

/**
 * Named array information for .data and .data2d declarations
 */
export interface NamedArray {
  /** The array identifier name */
  name: string;
  /** Base address in bytes where the array starts */
  baseAddress: number;
  /** Number of elements in the array (rows * cols for 2D) */
  length: number;
  /** Index in the flattened global data[] array */
  globalStartIndex: number;

  // 2D array fields (optional, only set for .data2d)
  /** True if this is a 2D array declared with .data2d */
  is2D?: boolean;
  /** Number of rows (only if is2D) */
  rows?: number;
  /** Number of columns (only if is2D) */
  cols?: number;
}

/**
 * Function definition stored in the symbol table
 */
export interface FunctionDefinition {
  /** Parameter names for the function */
  params: string[];
  /** Optional parameter types for documentation (e.g., 'R0', 'address') */
  paramTypes?: string[];
  /** Captured tokens forming the function body */
  tokens: Token[];
}

/**
 * Typed parameter for kernel modules
 */
export interface ModuleParameter {
  /** Parameter name (e.g., 'a', 'out') */
  name: string;
  /** Parameter type - typically a register (e.g., 'R0', 'ROUT') */
  type: string;
}

/**
 * Kernel module definition for reusable multi-cycle blocks
 */
export interface KernelModule {
  /** Module name */
  name: string;
  /** Typed parameters for the module */
  parameters: ModuleParameter[];
  /** Captured tokens forming the module body (including cycle blocks) */
  bodyTokens: Token[];
  /** Internal labels that need prefixing when expanded */
  internalLabels: string[];
}

/**
 * Symbol table for tracking identifiers during compilation
 */
export interface SymbolTable {
  /** Constants defined with .const directive: name -> value string */
  constants: Map<string, string>;
  /** Register aliases defined with .alias directive: alias -> register */
  aliases: Map<string, string>;
  /** Labels for branch targets: label -> cycle number */
  labels: Map<string, number>;
  /** Function definitions: name -> FunctionDefinition */
  functions: Map<string, FunctionDefinition>;
  /** Named arrays from .data declarations: name -> NamedArray */
  namedArrays: Map<string, NamedArray>;
  /** Kernel modules: name -> KernelModule */
  modules: Map<string, KernelModule>;
}

/**
 * Creates an empty symbol table
 */
export function createSymbolTable(): SymbolTable {
  return {
    constants: new Map(),
    aliases: new Map(),
    labels: new Map(),
    functions: new Map(),
    namedArrays: new Map(),
    modules: new Map()
  };
}

/**
 * Clones a symbol table (creates a shallow copy of all maps)
 */
export function cloneSymbolTable(table: SymbolTable): SymbolTable {
  return {
    constants: new Map(table.constants),
    aliases: new Map(table.aliases),
    labels: new Map(table.labels),
    functions: new Map(table.functions),
    namedArrays: new Map(table.namedArrays),
    modules: new Map(table.modules)
  };
}

/**
 * Array property types supported by named arrays
 * - len: total number of elements
 * - base: base memory address
 * - size: total size in bytes (length * 4)
 * - last: last valid index (length - 1)
 * - rows: number of rows (2D only, returns 1 for 1D)
 * - cols: number of columns (2D only, returns length for 1D)
 * - dim: dimensionality (1 for 1D, 2 for 2D)
 */
export type ArrayProperty = 'len' | 'base' | 'size' | 'last' | 'rows' | 'cols' | 'dim';

/**
 * Checks if a string is a valid array property name
 */
export function isArrayProperty(name: string): name is ArrayProperty {
  return ['len', 'base', 'size', 'last', 'rows', 'cols', 'dim'].includes(name);
}

/**
 * Gets the value of an array property
 */
export function getArrayPropertyValue(
  array: NamedArray,
  property: ArrayProperty
): number {
  switch (property) {
    case 'len':
      return array.length;
    case 'base':
      return array.baseAddress;
    case 'size':
      return array.length * 4; // 4 bytes per element
    case 'last':
      return array.length - 1;
    case 'rows':
      return array.rows ?? 1; // 1D arrays have 1 row
    case 'cols':
      return array.cols ?? array.length; // 1D arrays: cols = length
    case 'dim':
      return array.is2D ? 2 : 1;
  }
}
