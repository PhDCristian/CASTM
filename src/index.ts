/**
 * OpenEdge-DSL Compiler
 *
 * Main entry point for the DSL compiler module.
 * Provides functions for tokenizing, parsing, and compiling DSL source code.
 *
 * ## Module Structure
 *
 * The DSL compiler is organized into the following modules:
 *
 * ### Types (`./types/`)
 * - **tokens.ts**: Token type definitions (TokenType enum, Token interface)
 * - **ast.ts**: Abstract Syntax Tree node interfaces (KernelAst, CycleBlock, Instruction)
 * - **symbols.ts**: Symbol table types (SymbolTable, NamedArray, FunctionDefinition)
 * - **errors.ts**: Diagnostic and error types (DiagnosticSeverity, ErrorCodes)
 *
 * ### Lexer (`./lexer/`)
 * - **lexer.ts**: Main tokenizer (tokenize, tokenStream)
 * - **patterns.ts**: Regex patterns and character classification
 *
 * ### Parser (`./parser/`)
 * - **token-stream.ts**: Token stream abstraction for parsing
 * - **parser-state.ts**: Parser state and AST construction
 * - **directive-parser.ts**: Directive handling (.const, .alias, .data, etc.)
 * - **pragma-parser.ts**: Pragma handling (#pragma parallel, reduce, etc.)
 *
 * ### Semantic Analysis (`./semantic/`)
 * - **symbol-resolver.ts**: Symbol resolution and lookup
 * - **operand-substitution.ts**: Loop variable and array property substitution
 *
 * ### Code Generation (`./codegen/`)
 * - **instruction-emitter.ts**: Instruction formatting and grid emission
 * - **csv-generator.ts**: CSV output generation from AST
 *
 * ### Diagnostics (`./diagnostics/`)
 * - **validator.ts**: Static analysis and error detection
 *
 * ### Utilities (`./utils/`)
 * - **string-utils.ts**: String manipulation helpers
 * - **source-location.ts**: Source position tracking
 * - **expression.ts**: Expression evaluation
 *
 * ## Usage
 *
 * ```typescript
 * import { tokenize, TokenType } from '@core/dsl';
 *
 * // Tokenize source code
 * const tokens = tokenize(sourceCode);
 *
 * // Filter specific token types
 * const keywords = tokens.filter(t => t.type === TokenType.KEYWORD);
 * ```
 *
 * ## Portability
 *
 * The core compiler modules have no dependencies on React, Monaco, or browser APIs.
 * They can be used in:
 * - Browser applications
 * - Node.js CLI tools
 * - VS Code extensions
 * - NPM packages
 *
 * Monaco-specific integration is available separately in:
 * `@features/develop/code/monaco/`
 */

// ==========================================
// Type Exports
// ==========================================
export * from './types';

// ==========================================
// Lexer Exports
// ==========================================
export { tokenize, tokenStream } from './lexer';
export {
  isWhitespace,
  isNewline,
  isIdentifierStart,
  isIdentifierPart,
  isDigit,
  isHexDigit,
  isKeyword,
  DSL_KEYWORDS
} from './lexer';

// ==========================================
// Parser Exports
// ==========================================
export {
  TokenStream,
  createTokenStream,
  type ParserState,
  createParserState,
  createEmptyAst,
  createCycleBlock,
  createInstruction,
  // Pattern generators
  generateReduceTokens,
  generateStencilTokens,
  generateRouteTokens,
  generateScanTokens,
  generateBroadcastTokens,
  generateRotateTokens,
  // Instruction parsing
  parseInstruction,
  extractNumericValue,
  evaluateSimpleExpression,
  OPCODE_ALIASES,
  // Directive parsing
  parseDirective,
  isKnownDirective,
  // Pragma parsing
  parsePragma,
  parseReducePragmaArgs,
  parseStencilPragmaArgs,
  parseRoutePragmaArgs,
  parseScanPragmaArgs,
  parseBroadcastPragmaArgs,
  parseRotateShiftPragmaArgs,
  isCodeGeneratingPragma,
  isLoopPragma,
  PRAGMA_NAMES,
  // Control flow utilities
  type RangeArgs,
  type LocationSpec,
  parseRangeArgs,
  calculateIterations as calculateLoopIterations,
  validateIterationCount,
  calculateNeighborRef,
  getBranchInstruction,
  createToken,
  createBranchInstruction,
  createJumpInstruction,
  createIncrementInstruction,
  countCyclesInTokens,
  createLocationPrefix,
  createCycleHeader,
  createCycleFooter,
  createLabeledCycleHeader,
  replaceVariable,
  COMPARISON_OPERATORS,
  RESERVED_LOOP_VARIABLES,
  // Cycle parsing
  type CycleParserContext,
  type CycleParseResult,
  parseCycleBlock,
  parseOptionalLabel,
  createEmptyCycleBlock,
  // For loop parsing
  type ForLoopParseContext,
  type ForLoopParseResult,
  parseForLoop,
  // While loop parsing
  type WhileLoopParseContext,
  type WhileLoopParseResult,
  parseWhileLoop,
  // If-else parsing
  type IfElseParseContext,
  type IfElseParseResult,
  parseIfElse,
  parseCondition,
  parseLocation,
  // Function parsing
  parseFunctionArgs,
  expandFunctionTokens,
  expandFunctionCall
} from './parser';

// ==========================================
// Semantic Analysis Exports
// ==========================================
export {
  resolveOperand,
  resolveArrayReference,
  resolveArrayProperty,
  buildDataIndexMap,
  substituteLoopVariable,
  resolveRangeExpression,
  calculateIterations,
  isRegisterName,
  isNeighborReference,
  isImmediate
} from './semantic';

// ==========================================
// Code Generation Exports
// ==========================================
export {
  generateCsv,
  formatInstruction,
  formatRow,
  formatCycleBlock,
  makeInstruction,
  makeNop,
  makeExit,
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_COLS,
  type CsvGeneratorOptions,
  type CsvGeneratorResult
} from './codegen';

// ==========================================
// Diagnostics Exports
// ==========================================
export {
  validateTokens,
  validateStructure,
  validateDuplicatePEInstructions,
  validateInstructionOperands,
  INSTRUCTION_OPERANDS,
  isValidOpcode,
  isValidRegister,
  isValidNeighbor,
  suggestSimilar,
  type GridBounds,
  VALID_REGISTERS,
  VALID_NEIGHBORS,
  VALID_OPCODES
} from './diagnostics';

// ==========================================
// Utility Exports
// ==========================================
export * from './utils';

// ==========================================
// Compilation Result Type
// ==========================================

/**
 * Result of compiling DSL source code
 */
export interface CompilationResult {
  /** Whether compilation succeeded */
  success: boolean;
  /** Generated CSV output (if successful) */
  csv?: string;
  /** Memory initialization data */
  memoryInit?: Map<number, number[]>;
  /** IO configuration */
  ioConfig?: {
    loadAddrs: number[];
    storeAddrs: number[];
  };
  /** Maximum cycle count */
  maxCycles?: number;
  /** Compile-time assertions */
  assertions?: Array<{
    cycle: number;
    row: number;
    col: number;
    register: string;
    value: number;
  }>;
  /** Suggested grid size based on 2D arrays */
  suggestedGridSize?: { width: number; height: number };
  /** Error message (if failed) */
  error?: string;
  /** Error line number (if available) */
  line?: number;
}

// ==========================================
// NOTE: Main Compile Function
// ==========================================
//
// The main compile() function is currently in src/utils/dsl-compiler.ts
// as compileDslToCsv(). This is because the full parser implementation
// still resides there.
//
// Future migration path:
// 1. Extract remaining parser logic to ./parser/
// 2. Move compileDslToCsv() here as compile()
// 3. Update imports across the codebase
// 4. Deprecate src/utils/dsl-compiler.ts
