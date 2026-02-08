/**
 * OpenEdge-DSL Error and Diagnostic Types
 *
 * Defines types for error handling and IDE diagnostics.
 */

/**
 * Severity levels for diagnostics
 */
export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

/**
 * Source location range for error reporting
 */
export interface SourceRange {
  /** Starting line number (1-based) */
  startLine: number;
  /** Starting column number (1-based) */
  startColumn: number;
  /** Ending line number (1-based) */
  endLine: number;
  /** Ending column number (1-based) */
  endColumn: number;
}

/**
 * A diagnostic message from compilation or validation
 */
export interface Diagnostic {
  /** Severity of the diagnostic */
  severity: DiagnosticSeverity;
  /** Source location range */
  range: SourceRange;
  /** Human-readable error message */
  message: string;
  /** Optional error code for categorization */
  code?: string;
  /** Optional source identifier (e.g., 'openedge-dsl') */
  source?: string;
  /** Optional related information */
  relatedInformation?: DiagnosticRelatedInformation[];
}

/**
 * Related information for a diagnostic
 */
export interface DiagnosticRelatedInformation {
  /** Location of the related code */
  range: SourceRange;
  /** Description of the relationship */
  message: string;
}

/**
 * Compilation error with source location
 */
export interface CompilationError {
  /** Error message */
  message: string;
  /** Line number where the error occurred (1-based) */
  line: number;
  /** Column number where the error occurred (1-based) */
  column?: number;
  /** Optional error code */
  code?: string;
}

/**
 * Creates a compilation error with location
 */
export function createError(
  message: string,
  line: number,
  column?: number,
  code?: string
): CompilationError {
  return { message, line, column, code };
}

/**
 * Creates a diagnostic from a compilation error
 */
export function errorToDiagnostic(
  error: CompilationError,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error
): Diagnostic {
  const startColumn = error.column ?? 1;
  return {
    severity,
    range: {
      startLine: error.line,
      startColumn,
      endLine: error.line,
      endColumn: startColumn + 1
    },
    message: error.message,
    code: error.code,
    source: 'openedge-dsl'
  };
}

/**
 * Creates a diagnostic for a specific range
 */
export function createDiagnostic(
  message: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error,
  code?: string
): Diagnostic {
  return {
    severity,
    range: { startLine, startColumn, endLine, endColumn },
    message,
    code,
    source: 'openedge-dsl'
  };
}

/**
 * Error codes for common DSL errors
 */
export const ErrorCodes = {
  // Lexer errors (1xxx)
  UNEXPECTED_CHARACTER: 'E1001',
  UNTERMINATED_STRING: 'E1002',
  INVALID_NUMBER: 'E1003',
  UNKNOWN_DIRECTIVE: 'E1004',

  // Parser errors (2xxx)
  UNEXPECTED_TOKEN: 'E2001',
  EXPECTED_TOKEN: 'E2002',
  MISSING_KERNEL: 'E2003',
  MISSING_CONFIG: 'E2004',
  INVALID_SYNTAX: 'E2005',

  // Semantic errors (3xxx)
  UNDEFINED_IDENTIFIER: 'E3001',
  UNDEFINED_ARRAY: 'E3002',
  ARRAY_OUT_OF_BOUNDS: 'E3003',
  INVALID_REGISTER: 'E3004',
  INVALID_OPERAND: 'E3005',
  DUPLICATE_DEFINITION: 'E3006',
  UNDEFINED_LABEL: 'E3007',
  UNDEFINED_FUNCTION: 'E3008',

  // Code generation errors (4xxx)
  INVALID_INSTRUCTION: 'E4001',
  INVALID_BRANCH_TARGET: 'E4002',
  MEMORY_OVERLAP: 'E4003',
  INVALID_OPERAND_COUNT: 'E4004',

  // Warnings (5xxx)
  DUPLICATE_PE_INSTRUCTION: 'W5001'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
