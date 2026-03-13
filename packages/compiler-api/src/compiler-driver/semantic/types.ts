import { AstProgram, Diagnostic } from '@castm/compiler-ir';

export interface SemanticPassResult {
  ast: AstProgram;
  diagnostics: Diagnostic[];
  loweredPasses: string[];
}
