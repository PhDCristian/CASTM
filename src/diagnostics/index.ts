/**
 * OpenEdge-DSL Diagnostics Module
 *
 * Provides validation and error reporting.
 */

export {
  type GridBounds,
  VALID_REGISTERS,
  VALID_NEIGHBORS,
  VALID_OPCODES,
  validateTokens,
  validateStructure,
  validateDuplicatePEInstructions,
  validateInstructionOperands,
  INSTRUCTION_OPERANDS,
  isValidOpcode,
  isValidRegister,
  isValidNeighbor,
  suggestSimilar
} from './validator';
