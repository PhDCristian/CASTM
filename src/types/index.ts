/**
 * OpenEdge-DSL Type Definitions
 *
 * Central export point for all DSL type definitions.
 */

// Token types
export {
  TokenType,
  type Token,
  DSL_KEYWORDS,
  DSL_DIRECTIVES,
  DSL_PRAGMAS,
  type DslKeyword,
  type DslDirective,
  type DslPragma
} from './tokens';

// AST types
export {
  type Instruction,
  type CycleBlock,
  type KernelConfig,
  type IoConfig,
  type Assertion,
  type KernelAst,
  type PragmaModifier,
  type PragmaDirective,
  type Condition,
  type PeLocation,
  type ParsedCycle,
  type IfElseStructure,
  type BodyElementType,
  type BodyElement,
  type WhileBodyAnalysis
} from './ast';

// Symbol table types
export {
  type NamedArray,
  type FunctionDefinition,
  type SymbolTable,
  createSymbolTable,
  cloneSymbolTable,
  type ArrayProperty,
  isArrayProperty,
  getArrayPropertyValue
} from './symbols';

// Error and diagnostic types
export {
  DiagnosticSeverity,
  type SourceRange,
  type Diagnostic,
  type DiagnosticRelatedInformation,
  type CompilationError,
  createError,
  errorToDiagnostic,
  createDiagnostic,
  ErrorCodes,
  type ErrorCode
} from './errors';
