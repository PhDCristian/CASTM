import {
  AstProgram,
  CompilerPass
} from '@castm/compiler-ir';
import { cloneAst } from '../ast-utils.js';

export const desugarAutoCyclePass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-auto-cycle',
  run(input) {
    return { output: cloneAst(input), diagnostics: [] };
  }
};
