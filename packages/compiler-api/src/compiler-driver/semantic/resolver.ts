import {
  AstProgram,
  Diagnostic
} from '@openedge/compiler-ir';
import { SemanticPassResult } from './types.js';

export function runSemanticResolver(ast: AstProgram, diagnostics: Diagnostic[]): SemanticPassResult {
  return {
    ast,
    diagnostics,
    loweredPasses: ['semantic-resolver']
  };
}
