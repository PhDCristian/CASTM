import {
  AstProgram,
  CycleAst,
  DirectiveAst,
  Diagnostic,
  KernelAst,
  ParseResult,
  SourceSpan,
  spanAt
} from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic } from '@openedge/compiler-ir';
import { consumeCycleScopeStatement } from './parser-core/cycle-scope.js';
import { consumeKernelScopeStatement } from './parser-core/kernel-scope.js';
import { consumeTopLevelScopeStatement } from './parser-core/top-level-scope.js';
import { stripLineComment } from './parser-utils/strings.js';
import type { FunctionDefinitionLike } from './parser-core/for-expand.js';

export function parseSource(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const lines = source.split(/\r?\n/);

  const span: SourceSpan = {
    startLine: 1,
    startColumn: 1,
    endLine: lines.length,
    endColumn: (lines[lines.length - 1] || '').length + 1
  };

  const ast: AstProgram = {
    targetProfileId: null,
    kernel: null,
    span
  };

  let kernel: KernelAst | null = null;
  let kernelConstants = new Map<string, number>();
  let inKernel = false;
  let inCycle = false;
  let currentCycle: CycleAst | null = null;
  let cycleConstants = new Map<string, number>();
  let cycleIndex = 0;
  const functionExpansionCounter = { value: 0 };
  const controlFlowCounter = { value: 0 };
  const pendingDirectives: DirectiveAst[] = [];
  const functions = new Map<string, FunctionDefinitionLike>();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i];
    const clean = stripLineComment(rawLine).trim();

    if (!clean) continue;

    if (!inKernel) {
      const consumed = consumeTopLevelScopeStatement({
        lines,
        index: i,
        lineNo,
        clean,
        ast,
        kernel,
        kernelConstants,
        pendingDirectives,
        functions,
        diagnostics
      });

      kernel = consumed.kernel;
      kernelConstants = consumed.kernelConstants;
      inKernel = consumed.inKernel;
      if (consumed.shouldBreak) break;
      i = consumed.nextIndex;
      continue;
    }

    if (inKernel && !inCycle) {
      if (clean === '}') {
        inKernel = false;
        continue;
      }

      const consumed = consumeKernelScopeStatement({
        lines,
        index: i,
        lineNo,
        clean,
        kernel,
        functions,
        kernelConstants,
        diagnostics,
        cycleIndex,
        functionExpansionCounter,
        controlFlowCounter
      });

      kernelConstants = consumed.kernelConstants;
      cycleIndex = consumed.cycleIndex;
      if (consumed.shouldBreak) break;
      if (consumed.enterCycle) {
        inCycle = true;
        currentCycle = consumed.currentCycle;
        cycleConstants = consumed.cycleConstants;
      }
      i = consumed.nextIndex;
      continue;
    }

    if (inCycle) {
      if (clean === '}') {
        if (kernel && currentCycle) {
          kernel.cycles.push(currentCycle);
        }
        currentCycle = null;
        inCycle = false;
        continue;
      }

      const consumed = consumeCycleScopeStatement({
        lines,
        index: i,
        lineNo,
        rawLine,
        clean,
        cycleConstants,
        diagnostics,
        currentCycle
      });
      currentCycle = consumed.currentCycle;
      if (consumed.shouldBreak) break;
      i = consumed.nextIndex;
    }
  }

  if (inCycle) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      'Unterminated cycle block.',
      'Add a closing brace for cycle { ... }.'
    ));
  }

  if (inKernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      'Unterminated kernel block.',
      'Add a closing brace for kernel { ... }.'
    ));
  }

  if (!ast.targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing required target declaration.',
      'Add: target "uma-cgra-base";'
    ));
  }

  if (!ast.kernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingKernel,
      'error',
      spanAt(1, 1, 1),
      'Missing kernel declaration.',
      'Add: kernel "Name" { ... }'
    ));
  }

  return {
    success: diagnostics.every((d) => d.severity !== 'error'),
    ast,
    diagnostics
  };
}
