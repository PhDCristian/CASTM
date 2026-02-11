import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseDirective } from '../declarations.js';
import { parseFunctionHeader, parseFunctionParams } from '../functions.js';
import { collectBlockFromSource } from '../../parser-utils/blocks.js';
import type { ConsumeTopLevelScopeInput } from './types.js';
import { buildConstantMap } from './constants.js';

export interface TopLevelScopeWorkingState {
  kernel: ConsumeTopLevelScopeInput['kernel'];
  kernelConstants: ConsumeTopLevelScopeInput['kernelConstants'];
  pendingDirectives: ConsumeTopLevelScopeInput['pendingDirectives'];
  functions: ConsumeTopLevelScopeInput['functions'];
}

export interface TopLevelScopeStepResult {
  handled: boolean;
  nextIndex?: number;
  inKernel?: boolean;
  shouldBreak?: boolean;
}

export function createTopLevelScopeWorkingState(input: ConsumeTopLevelScopeInput): TopLevelScopeWorkingState {
  return {
    kernel: input.kernel,
    kernelConstants: input.kernelConstants,
    pendingDirectives: input.pendingDirectives,
    functions: input.functions
  };
}

export function consumeLegacyPragmaStep(input: ConsumeTopLevelScopeInput): boolean {
  const topPragma = input.clean.match(/^#pragma\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+.*)?$/i);
  if (!topPragma) return false;

  input.diagnostics.push(makeDiagnostic(
    ErrorCodes.Parse.InvalidSyntax,
    'error',
    spanAt(input.lineNo, 1, input.clean.length),
    `Legacy pragma syntax is not supported: '${input.clean}'.`,
    'Use canonical declarations and statements.'
  ));
  return true;
}

export function consumeFunctionDefinitionStep(
  input: ConsumeTopLevelScopeInput,
  state: TopLevelScopeWorkingState
): TopLevelScopeStepResult {
  const functionHeader = parseFunctionHeader(input.clean);
  if (!functionHeader) {
    return { handled: false };
  }

  const params = parseFunctionParams(functionHeader.paramsText, input.lineNo, input.diagnostics);
  const block = collectBlockFromSource(input.lines, input.index);
  if (block.endIndex === null) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.lineNo, 1, input.clean.length),
      `Unterminated function '${functionHeader.name}'.`,
      'Add a closing brace for function { ... }.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: true };
  }

  if (params && !state.functions.has(functionHeader.name)) {
    state.functions.set(functionHeader.name, {
      name: functionHeader.name,
      params,
      body: block.body,
      span: spanAt(input.lineNo, 1, input.clean.length)
    });
  } else if (params) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.lineNo, 1, input.clean.length),
      `Duplicate function definition '${functionHeader.name}'.`,
      'Use unique function names.'
    ));
  }

  return { handled: true, nextIndex: block.endIndex };
}

export function consumeTargetStep(input: ConsumeTopLevelScopeInput): boolean {
  const targetMatch = input.clean.match(/^target\s+"([^"]+)"\s*;?\s*$/i);
  if (!targetMatch) return false;
  input.ast.targetProfileId = targetMatch[1];
  return true;
}

export function consumeKernelDeclarationStep(
  input: ConsumeTopLevelScopeInput,
  state: TopLevelScopeWorkingState
): TopLevelScopeStepResult {
  const kernelMatch = input.clean.match(/^kernel\s+"([^"]+)"\s*\{\s*$/i);
  if (!kernelMatch) {
    return { handled: false };
  }

  const initialDirectives = [...state.pendingDirectives];
  state.kernel = {
    name: kernelMatch[1],
    config: undefined,
    cycles: [],
    directives: initialDirectives,
    pragmas: [],
    span: spanAt(input.lineNo, 1, input.clean.length)
  };
  state.kernelConstants = buildConstantMap(initialDirectives, input.diagnostics);
  input.ast.kernel = state.kernel;
  state.pendingDirectives.length = 0;

  return { handled: true, nextIndex: input.index, inKernel: true };
}

export function consumeTopDirectiveStep(
  input: ConsumeTopLevelScopeInput,
  state: TopLevelScopeWorkingState
): TopLevelScopeStepResult {
  const topDirective = parseDirective(input.clean, input.lineNo);
  if (!topDirective) {
    return { handled: false };
  }

  if (!input.ast.kernel) {
    state.pendingDirectives.push(topDirective);
    return { handled: true };
  }

  input.diagnostics.push(makeDiagnostic(
    ErrorCodes.Parse.InvalidSyntax,
    'error',
    spanAt(input.lineNo, 1, input.clean.length),
    `Unexpected top-level directive after kernel declaration: '${input.clean}'`,
    'Move directives into kernel block or place them before kernel declaration.'
  ));
  return { handled: true };
}

export function reportUnexpectedTopLevelStatement(input: ConsumeTopLevelScopeInput): void {
  input.diagnostics.push(makeDiagnostic(
    ErrorCodes.Parse.InvalidSyntax,
    'error',
    spanAt(input.lineNo, 1, input.clean.length),
    `Unexpected top-level statement: '${input.clean}'`,
    'Expected target declaration or kernel block.'
  ));
}
