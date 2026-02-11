import { AstProgram, Diagnostic, DirectiveAst, KernelAst } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseDirective } from './declarations.js';
import { parseFunctionHeader, parseFunctionParams } from './functions.js';
import type { FunctionDefinitionLike } from './for-expand.js';
import { collectBlockFromSource } from '../parser-utils/blocks.js';
import { evaluateNumericExpression } from '../parser-utils/numbers.js';

function buildConstantMap(directives: DirectiveAst[], diagnostics: Diagnostic[]): Map<string, number> {
  const constants = new Map<string, number>();

  for (const directive of directives) {
    if (directive.kind !== 'const') continue;
    const value = evaluateNumericExpression(directive.value, constants, new Map());
    if (value === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        directive.span,
        `Invalid numeric value for constant '${directive.name}': '${directive.value}'.`,
        'Use integer expressions referencing previously declared constants.'
      ));
      continue;
    }
    constants.set(directive.name, value);
  }

  return constants;
}

export interface ConsumeTopLevelScopeInput {
  lines: string[];
  index: number;
  lineNo: number;
  clean: string;
  ast: AstProgram;
  kernel: KernelAst | null;
  kernelConstants: Map<string, number>;
  pendingDirectives: DirectiveAst[];
  functions: Map<string, FunctionDefinitionLike>;
  diagnostics: Diagnostic[];
}

export interface ConsumeTopLevelScopeResult {
  nextIndex: number;
  kernel: KernelAst | null;
  kernelConstants: Map<string, number>;
  pendingDirectives: DirectiveAst[];
  functions: Map<string, FunctionDefinitionLike>;
  inKernel: boolean;
  shouldBreak: boolean;
}

export function consumeTopLevelScopeStatement(input: ConsumeTopLevelScopeInput): ConsumeTopLevelScopeResult {
  const {
    lines,
    index,
    lineNo,
    clean,
    ast,
    diagnostics
  } = input;
  let kernel = input.kernel;
  let kernelConstants = input.kernelConstants;
  const pendingDirectives = input.pendingDirectives;
  const functions = input.functions;

  const keep = (nextIndex = index, inKernel = false, shouldBreak = false): ConsumeTopLevelScopeResult => ({
    nextIndex,
    kernel,
    kernelConstants,
    pendingDirectives,
    functions,
    inKernel,
    shouldBreak
  });

  const topPragma = clean.match(/^#pragma\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+.*)?$/i);
  if (topPragma) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, clean.length),
      `Legacy pragma syntax is not supported: '${clean}'.`,
      'Use canonical declarations and statements.'
    ));
    return keep();
  }

  const functionHeader = parseFunctionHeader(clean);
  if (functionHeader) {
    const params = parseFunctionParams(functionHeader.paramsText, lineNo, diagnostics);
    const block = collectBlockFromSource(lines, index);
    if (block.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        `Unterminated function '${functionHeader.name}'.`,
        'Add a closing brace for function { ... }.'
      ));
      return keep(index, false, true);
    }

    if (params && !functions.has(functionHeader.name)) {
      functions.set(functionHeader.name, {
        name: functionHeader.name,
        params,
        body: block.body,
        span: spanAt(lineNo, 1, clean.length)
      });
    } else if (params) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        `Duplicate function definition '${functionHeader.name}'.`,
        'Use unique function names.'
      ));
    }

    return keep(block.endIndex);
  }

  const targetMatch = clean.match(/^target\s+"([^"]+)"\s*;?\s*$/i);
  if (targetMatch) {
    ast.targetProfileId = targetMatch[1];
    return keep();
  }

  const kernelMatch = clean.match(/^kernel\s+"([^"]+)"\s*\{\s*$/i);
  if (kernelMatch) {
    const initialDirectives = [...pendingDirectives];
    kernel = {
      name: kernelMatch[1],
      config: undefined,
      cycles: [],
      directives: initialDirectives,
      pragmas: [],
      span: spanAt(lineNo, 1, clean.length)
    };
    kernelConstants = buildConstantMap(initialDirectives, diagnostics);
    ast.kernel = kernel;
    pendingDirectives.length = 0;
    return keep(index, true);
  }

  const topDirective = parseDirective(clean, lineNo);
  if (topDirective) {
    if (!ast.kernel) {
      pendingDirectives.push(topDirective);
      return keep();
    }

    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, clean.length),
      `Unexpected top-level directive after kernel declaration: '${clean}'`,
      'Move directives into kernel block or place them before kernel declaration.'
    ));
    return keep();
  }

  diagnostics.push(makeDiagnostic(
    ErrorCodes.Parse.InvalidSyntax,
    'error',
    spanAt(lineNo, 1, clean.length),
    `Unexpected top-level statement: '${clean}'`,
    'Expected target declaration or kernel block.'
  ));
  return keep();
}
