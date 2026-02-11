import { parseSource } from './parser.js';
import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  makeDiagnostic,
  ParseResult,
  spanAt,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import { lowerStructuredProgramToAst, toStructuredProgramAst } from './structured-core/conversion.js';
import { parseStructuredProgramFromSource } from './structured-core/parse-source.js';

export {
  lowerStructuredProgramToAst,
  parseStructuredProgramFromSource,
  toStructuredProgramAst
};

export interface StructuredParseResult extends ParseResult {
  structuredAst?: StructuredProgramAst;
  ast?: AstProgram;
  diagnostics: Diagnostic[];
}

function hasFunctionCalls(structuredAst: StructuredProgramAst | undefined): boolean {
  const body = structuredAst?.kernel?.body ?? [];
  const visit = (nodes: typeof body): boolean => {
    for (const node of nodes) {
      if (node.kind === 'fn-call') return true;
      if (node.kind === 'for' && visit(node.body)) return true;
      if (node.kind === 'if') {
        if (visit(node.thenBody)) return true;
        if (node.elseBody && visit(node.elseBody)) return true;
      }
      if (node.kind === 'while' && visit(node.body)) return true;
    }
    return false;
  };
  return visit(body);
}

function needsClassicParserFallback(source: string): boolean {
  if (/(^|\n)\s*#pragma\b/i.test(source)) return true;
  if (/(^|\n)\s*\.(const|alias|data|data2d|io_load|io_store|limit|assert)\b/i.test(source)) return true;
  if (/(^|\n)\s*function\b/i.test(source)) return true;
  if (/(?<!\bat\s)\b(?:row|col)\s+\d+\s*:/i.test(source)) return true;
  if (/(?<!\bat\s)\ball\s*:/i.test(source)) return true;
  if (/(^|\n)\s*(?:if|while)\s*\([^\n]+\)\s*@\s*[^,\s]+\s*,\s*[^\s\{]+\s*\{/i.test(source)) return true;
  if (/(^|\n)\s*for\s+[^\n]*\)\s*@\s*[^,\s]+\s*,\s*[^\s\{]+\s*(?:runtime\s*)?\{/i.test(source)) return true;
  return false;
}

function validateStructuredMinimum(structuredAst: StructuredProgramAst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!structuredAst.targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing required target declaration.',
      'Add: target "uma-cgra-base";'
    ));
  }
  if (!structuredAst.kernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingKernel,
      'error',
      spanAt(1, 1, 1),
      'Missing kernel declaration.',
      'Add: kernel "Name" { ... }'
    ));
  }
  return diagnostics;
}

export function parseStructuredSource(source: string): StructuredParseResult {
  const structuredAst = parseStructuredProgramFromSource(source);
  const shouldFallback = needsClassicParserFallback(source) || hasFunctionCalls(structuredAst);
  if (!shouldFallback) {
    const diagnostics = validateStructuredMinimum(structuredAst);
    const ast = lowerStructuredProgramToAst(structuredAst);
    return {
      success: diagnostics.every((d) => d.severity !== 'error'),
      diagnostics,
      structuredAst,
      ast
    };
  }

  const parsed = parseSource(source);

  return {
    ...parsed,
    structuredAst,
    ast: parsed.ast
  };
}
