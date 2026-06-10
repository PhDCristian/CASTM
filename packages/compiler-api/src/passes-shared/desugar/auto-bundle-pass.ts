import {
  AstProgram,
  CompilerPass
} from '@castm/compiler-ir';
import { cloneAst } from '../ast-utils.js';

export const desugarAutoBundlePass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-auto-bundle',
  run(input) {
    return { output: cloneAst(input), diagnostics: [] };
  }
};
