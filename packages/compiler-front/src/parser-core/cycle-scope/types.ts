import { CycleAst, Diagnostic } from '@openedge/compiler-ir';

export interface ConsumeCycleScopeInput {
  lines: string[];
  index: number;
  lineNo: number;
  rawLine: string;
  clean: string;
  cycleConstants: ReadonlyMap<string, number>;
  diagnostics: Diagnostic[];
  currentCycle: CycleAst | null;
}

export interface ConsumeCycleScopeResult {
  nextIndex: number;
  currentCycle: CycleAst | null;
  shouldBreak: boolean;
}
