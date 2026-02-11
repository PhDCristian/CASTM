import { AstProgram, Diagnostic } from '@openedge/compiler-ir';

export interface SemanticPassResult {
  ast: AstProgram;
  diagnostics: Diagnostic[];
  loweredPasses: string[];
}
