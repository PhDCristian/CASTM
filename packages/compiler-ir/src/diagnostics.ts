import { Diagnostic, DiagnosticSeverity, SourceSpan } from './common.js';

export const ErrorCodes = {
  Parse: {
    MissingTarget: 'E2001',
    InvalidSyntax: 'E2002',
    MissingKernel: 'E2003'
  },
  Semantic: {
    InvalidAssignment: 'E3001',
    UnsupportedOperation: 'E3002',
    CoordinateOutOfBounds: 'E3003',
    Collision: 'E3004',
    UnknownOpcode: 'E3005',
    UnknownTargetProfile: 'E3006',
    InvalidGridSpec: 'E3007',
    UnsupportedPragma: 'E3008',
    UnknownLabel: 'E3009',
    DuplicateLabel: 'E3010',
    UnresolvedCoordinateExpression: 'E3011',
    InvalidLoopControl: 'E3012',
    InvalidCollectPath: 'E3013'
  },
  Internal: {
    UnexpectedState: 'E9001'
  }
} as const;

export const WarningCodes = {
  Style: {
    UnqualifiedStdBuiltin: 'W1101'
  }
} as const;

export function spanAt(line: number, column: number, length = 1): SourceSpan {
  return {
    startLine: line,
    startColumn: column,
    endLine: line,
    endColumn: column + Math.max(1, length)
  };
}

export function makeDiagnostic(
  code: string,
  severity: DiagnosticSeverity,
  span: SourceSpan,
  message: string,
  hint?: string,
  hintCode?: string
): Diagnostic {
  return { code, severity, span, message, hint, hintCode };
}
