/**
 * OpenEdge-DSL Code Generation Module
 *
 * Provides CSV generation and instruction formatting.
 */

// Instruction emitter
export {
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_COLS,
  formatInstruction,
  formatRow,
  formatCycleBlock,
  hasExitInstruction,
  createExitCycle,
  makeCoordKey,
  parseCoordKey,
  makeInstruction,
  makeNop,
  makeExit
} from './instruction-emitter';

// CSV generator
export {
  type CsvGeneratorOptions,
  type CsvGeneratorResult,
  generateCsv,
  validateCycleSequence,
  getMaxCycleNumber,
  getMinCycleNumber,
  renumberCycles,
  mergeCycles
} from './csv-generator';
