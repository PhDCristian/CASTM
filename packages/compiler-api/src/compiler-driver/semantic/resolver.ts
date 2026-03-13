import {
  AstProgram,
  Diagnostic
} from '@castm/compiler-ir';
import { SemanticPassResult } from './types.js';

export function runSemanticResolver(ast: AstProgram, diagnostics: Diagnostic[]): SemanticPassResult {
  return {
    ast,
    diagnostics,
    loweredPasses: ['semantic-resolver']
  };
}
