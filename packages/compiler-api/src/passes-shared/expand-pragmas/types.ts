import {
  CycleAst,
  Diagnostic,
  GridSpec,
  PragmaAst
} from '@castm/compiler-ir';

export interface ExpandPragmaContext {
  grid: GridSpec;
  generatedCycles: CycleAst[];
  diagnostics: Diagnostic[];
}

export type PragmaHandler = (pragma: PragmaAst, ctx: ExpandPragmaContext) => void;
