import {
  BundleAst,
  Diagnostic,
  GridSpec,
  AdvancedStatementAst
} from '@castm/compiler-ir';

export interface ExpandAdvancedStatementContext {
  grid: GridSpec;
  generatedBundles: BundleAst[];
  diagnostics: Diagnostic[];
}

export type AdvancedStatementHandler = (advancedStatement: AdvancedStatementAst, ctx: ExpandAdvancedStatementContext) => void;
