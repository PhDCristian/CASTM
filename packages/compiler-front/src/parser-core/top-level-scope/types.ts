import { AstProgram, Diagnostic, DirectiveAst, KernelAst } from '@openedge/compiler-ir';
import type { FunctionDefinitionLike } from '../for-expand.js';

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
