/**
 * OpenEdge-DSL Symbol Resolver
 *
 * Resolves identifiers to their values using the symbol table.
 */

import {
  SymbolTable,
  NamedArray,
  getArrayPropertyValue,
  isArrayProperty,
  ArrayProperty
} from '../types/symbols';
import { evaluateSimpleExpression, tokenizeExpression } from '../utils/expression';

/**
 * Result of resolving an operand
 */
export interface ResolveResult {
  /** The resolved value (as string) */
  value: string;
  /** Whether resolution was successful */
  resolved: boolean;
  /** Error message if resolution failed */
  error?: string;
}

/**
 * Resolves an operand using the symbol table
 * Handles: aliases, constants, labels, data references
 */
export function resolveOperand(
  operand: string,
  symbols: SymbolTable,
  dataIndexToAddress: number[]
): ResolveResult {
  // Clean up IMM(...) wrapper if present
  let op = operand;
  if (op.startsWith('IMM(') && op.endsWith(')')) {
    op = op.substring(4, op.length - 1);
  }

  // 1. Check Data Reference marker
  if (op.startsWith('__DATA_REF_')) {
    const index = parseInt(op.replace('__DATA_REF_', ''), 10);
    if (index >= 0 && index < dataIndexToAddress.length) {
      return { value: dataIndexToAddress[index].toString(), resolved: true };
    }
    return {
      value: op,
      resolved: false,
      error: `Data reference data[${index}] out of bounds (max ${dataIndexToAddress.length - 1})`
    };
  }

  // 2. Check Alias
  if (symbols.aliases.has(op)) {
    return { value: symbols.aliases.get(op)!, resolved: true };
  }

  // 3. Check Constant (direct name lookup, e.g., BASE, S01)
  if (symbols.constants.has(op)) {
    return { value: symbols.constants.get(op)!, resolved: true };
  }

  // 4. Check Constant with . prefix (legacy: .NAME)
  if (op.startsWith('.')) {
    const name = op.substring(1);
    if (symbols.constants.has(name)) {
      return { value: symbols.constants.get(name)!, resolved: true };
    }
  }

  // 5. Check Label (for branch targets)
  if (symbols.labels.has(op)) {
    return { value: symbols.labels.get(op)!.toString(), resolved: true };
  }

  // 6. Return as-is (might be a register, number, or unresolved)
  return { value: op, resolved: true };
}

/**
 * Tries to evaluate an index expression that may contain arithmetic
 * @param indexExpr The index expression string (e.g., "0", "i*8+j*4+k" with vars substituted)
 * @param symbols Symbol table for constant resolution
 * @returns The numeric index or null if cannot be evaluated
 */
function tryEvaluateIndex(indexExpr: string, symbols: SymbolTable): number | null {
  // First try simple parseInt for plain numbers
  const simpleNum = parseInt(indexExpr, 10);
  if (!isNaN(simpleNum) && /^-?\d+$/.test(indexExpr.trim())) {
    return simpleNum;
  }

  // Try to evaluate as an arithmetic expression
  try {
    const tokens = tokenizeExpression(indexExpr);
    if (tokens.length === 0) {
      return null;
    }
    const result = evaluateSimpleExpression(tokens, symbols);
    return result;
  } catch {
    // Expression contains unresolved variables or invalid syntax
    return null;
  }
}

/**
 * Resolves a named array reference like input[i] or data[0]
 * Supports complex arithmetic expressions like data[i*8+j*4+k]
 */
export function resolveArrayReference(
  arrayName: string,
  indexExpr: string,
  symbols: SymbolTable,
  globalDataLength: number
): ResolveResult {
  // Check for global 'data' reference
  if (arrayName === 'data') {
    const index = tryEvaluateIndex(indexExpr, symbols);
    if (index === null) {
      return {
        value: `data[${indexExpr}]`,
        resolved: false,
        error: `Cannot resolve index expression: ${indexExpr}`
      };
    }
    if (index < 0 || index >= globalDataLength) {
      return {
        value: `data[${indexExpr}]`,
        resolved: false,
        error: `Array index out of bounds: data[${index}] (max ${globalDataLength - 1})`
      };
    }
    // Return marker for later resolution
    return { value: `__DATA_REF_${index}`, resolved: true };
  }

  // Check for named array
  const namedArray = symbols.namedArrays.get(arrayName);
  if (!namedArray) {
    return {
      value: `${arrayName}[${indexExpr}]`,
      resolved: false,
      error: `Undefined array: ${arrayName}`
    };
  }

  // Try to resolve index using arithmetic expression evaluation
  const index = tryEvaluateIndex(indexExpr, symbols);
  if (index === null) {
    // Index might be a variable - return as marker for runtime resolution
    return { value: `${arrayName}[${indexExpr}]`, resolved: true };
  }

  // Bounds check
  if (index < 0 || index >= namedArray.length) {
    return {
      value: `${arrayName}[${indexExpr}]`,
      resolved: false,
      error: `Array index out of bounds: ${arrayName}[${index}] (length ${namedArray.length})`
    };
  }

  // Convert to global data index
  const globalIndex = namedArray.globalStartIndex + index;
  return { value: `__DATA_REF_${globalIndex}`, resolved: true };
}

/**
 * Resolves an array property like input.len()
 */
export function resolveArrayProperty(
  arrayName: string,
  propertyName: string,
  symbols: SymbolTable
): ResolveResult {
  const namedArray = symbols.namedArrays.get(arrayName);
  if (!namedArray) {
    return {
      value: `${arrayName}.${propertyName}()`,
      resolved: false,
      error: `Undefined array: ${arrayName}`
    };
  }

  if (!isArrayProperty(propertyName)) {
    return {
      value: `${arrayName}.${propertyName}()`,
      resolved: false,
      error: `Unknown array property: ${propertyName}. Valid properties: len, base, size, last`
    };
  }

  const value = getArrayPropertyValue(namedArray, propertyName);
  return { value: value.toString(), resolved: true };
}

/**
 * Builds a data index to address mapping for resolving data references
 */
export function buildDataIndexMap(memoryInit: Map<number, number[]>): number[] {
  const dataIndexToAddress: number[] = [];

  for (const [startAddr, values] of memoryInit.entries()) {
    for (let i = 0; i < values.length; i++) {
      // CGRA uses byte addressing for 32-bit words (stride of 4)
      dataIndexToAddress.push(startAddr + i * 4);
    }
  }

  return dataIndexToAddress;
}

/**
 * Calculates the total number of data elements across all memory regions
 */
export function getTotalDataLength(memoryInit: Map<number, number[]>): number {
  let total = 0;
  for (const values of memoryInit.values()) {
    total += values.length;
  }
  return total;
}

/**
 * Checks if a string looks like a register name
 */
export function isRegisterName(name: string): boolean {
  const upper = name.toUpperCase();
  return /^R[0-3]$/.test(upper) || upper === 'ROUT';
}

/**
 * Checks if a string looks like a neighbor reference
 */
export function isNeighborReference(name: string): boolean {
  const upper = name.toUpperCase();
  return ['SELF', 'RCL', 'RCR', 'RCT', 'RCB', 'ZERO'].includes(upper);
}

/**
 * Checks if a string looks like an immediate value
 */
export function isImmediate(value: string): boolean {
  // IMM(n) wrapper
  if (/^IMM\(-?\d+\)$/i.test(value)) {
    return true;
  }
  // Plain number
  if (/^-?\d+$/.test(value)) {
    return true;
  }
  // Hex number
  if (/^0[xX][0-9a-fA-F]+$/.test(value)) {
    return true;
  }
  return false;
}
