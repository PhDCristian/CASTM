/**
 * OpenEdge-DSL Parser Module
 *
 * Central export point for the parser components.
 */

// Token stream abstraction
export {
  TokenStream,
  createTokenStream
} from './token-stream';

// Parser state management
export {
  type ParserState,
  createParserState,
  createEmptyAst,
  createCycleBlock,
  createInstruction,
  addCycle,
  registerConstant,
  registerAlias,
  registerLabel,
  registerFunction,
  registerNamedArray,
  registerAnonymousData,
  setIoLoadAddrs,
  setIoStoreAddrs,
  setCycleLimit,
  setKernelName,
  setKernelConfig,
  addAssertion,
  setActivePragma,
  consumeActivePragma,
  nextCycleNumber,
  currentCycleNumber,
  allocateMemory,
  resolveNamedArray,
  resolveFunction,
  resolveConstant,
  resolveAlias,
  resolveLabel
} from './parser-state';

// Directive parsing
export {
  parseConstDirective,
  parseAliasDirective,
  parseLimitDirective,
  parseDataDirective,
  parseIoLoadDirective,
  parseIoStoreDirective,
  parseAssertDirective,
  parseDirective,
  isKnownDirective
} from './directive-parser';

// Pragma parsing
export {
  PRAGMA_NAMES,
  type PragmaName,
  isPragmaName,
  parsePragma,
  parseReducePragmaArgs,
  parseStencilPragmaArgs,
  parseRoutePragmaArgs,
  parseScanPragmaArgs,
  parseBroadcastPragmaArgs,
  parseRotateShiftPragmaArgs,
  getPragmaDescription,
  validatePragma,
  isLoopPragma,
  isCodeGeneratingPragma
} from './pragma-parser';

// Instruction parsing
export {
  OPCODE_ALIASES,
  extractNumericValue,
  evaluateSimpleExpression,
  parseInstruction
} from './instruction-parser';

// Pattern generators (reduce, stencil)
export {
  generateReduceTokens,
  generateStencilTokens
} from './pattern-generators';

// Route generator
export {
  generateRouteTokens
} from './route-generator';

// Scan generator
export {
  generateScanTokens
} from './scan-generator';

// Broadcast generator
export {
  generateBroadcastTokens
} from './broadcast-generator';

// Rotate/Shift generator
export {
  generateRotateTokens
} from './rotate-generator';

// Cycle parsing
export {
  type CycleParserContext,
  type CycleParseResult,
  parseCycleBlock,
  parseOptionalLabel,
  createEmptyCycleBlock
} from './cycle-parser';

// Control flow utilities
export {
  // Types
  type BodyFusionAnalysis,
  type RangeArgs,
  type ParsedCondition,
  type LocationSpec,
  // Constants
  RESERVED_LOOP_VARIABLES,
  COMPARISON_OPERATORS,
  MAX_LOOP_ITERATIONS,
  // Functions
  getBranchInstruction,
  parseRangeArgs,
  calculateIterations,
  validateIterationCount,
  calculateNeighborRef,
  createToken,
  createLabeledCycleHeader,
  createCycleHeader,
  createCycleFooter,
  createLocationPrefix,
  createBranchInstruction,
  createJumpInstruction,
  createIncrementInstruction,
  countCyclesInTokens,
  hasVisualSyntax,
  findPELocations,
  isVariableUsed,
  replaceVariable
} from './control-flow-utils';

// For loop parsing
export {
  type ForLoopParseContext,
  type ForLoopParseResult,
  parseForLoop
} from './for-loop-parser';

// While loop parsing
export {
  type WhileLoopParseContext,
  type WhileLoopParseResult,
  parseWhileLoop
} from './while-loop-parser';

// If-else parsing
export {
  type IfElseParseContext,
  type IfElseParseResult,
  parseIfElse,
  parseCondition,
  parseLocation
} from './if-else-parser';

// Function parsing
export {
  parseFunctionArgs,
  expandFunctionTokens,
  expandFunctionCall
} from './function-parser';
