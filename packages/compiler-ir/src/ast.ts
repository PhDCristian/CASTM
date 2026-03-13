import { SourceSpan } from './common.js';
import type { ExpansionMode } from './options.js';

export interface InstructionAst {
  text: string;
  opcode: string | null;
  operands: string[];
  span: SourceSpan;
}

export interface CycleStmtAt {
  kind: 'at';
  row: number;
  col: number;
  instruction: InstructionAst;
  span: SourceSpan;
}

export interface CycleStmtAtExpr {
  kind: 'at-expr';
  rowExpr: string;
  colExpr: string;
  instruction: InstructionAst;
  span: SourceSpan;
}

export interface CycleStmtRow {
  kind: 'row';
  row: number;
  instructions: InstructionAst[];
  span: SourceSpan;
}

export interface CycleStmtCol {
  kind: 'col';
  col: number;
  instruction: InstructionAst;
  span: SourceSpan;
}

export interface CycleStmtAll {
  kind: 'all';
  instruction: InstructionAst;
  span: SourceSpan;
}

export type CycleStatementAst = CycleStmtAt | CycleStmtAtExpr | CycleStmtRow | CycleStmtCol | CycleStmtAll;

export interface CycleAst {
  index: number;
  label?: string;
  statements: CycleStatementAst[];
  span: SourceSpan;
}

export interface DeclarationAst {
  kind: 'const' | 'alias' | 'data' | 'data2d';
  name: string;
  value: string;
  span: SourceSpan;
}

export type DirectiveAst = DeclarationAst;

export interface TargetAst {
  /**
   * Canonical profile id when known (`uma-cgra-base`, `uma-cgra-mesh`, ...).
   * Parser stores the raw token first; resolver may normalize aliases later.
   */
  id: string;
  raw: string;
  resolvedId?: string;
  span: SourceSpan;
}

export type OptimizeLevel = 'O0' | 'O1' | 'O2' | 'O3';
export type SchedulerMode = 'safe' | 'balanced' | 'aggressive';
export type SchedulerWindow = number | 'auto';
export type MemoryReorderPolicy = 'strict' | 'same_address_fence';
export type BuildTopology = 'torus' | 'mesh';

export interface BuildConfigAst {
  optimize?: OptimizeLevel;
  scheduler?: SchedulerMode;
  schedulerWindow?: SchedulerWindow;
  memoryReorder?: MemoryReorderPolicy;
  expansionMode?: ExpansionMode;
  jumpReuseDepth?: number;
  pruneNoopCycles?: boolean;
  grid?: {
    rows: number;
    cols: number;
    topology?: BuildTopology;
  };
  span: SourceSpan;
}

export interface PragmaAst {
  text: string;
  anchorCycleIndex?: number;
  label?: string;
  span: SourceSpan;
}

export interface AdvancedStmtAst {
  kind: string;
  text: string;
  span: SourceSpan;
}

export interface RuntimeForAst {
  variable: string;
  range: { start: string; end: string; step?: string };
  control: { row: string; col: string };
  span: SourceSpan;
}

export type SpatialStmtAst = CycleStatementAst;

export interface IoLoadStmtAst {
  kind: 'io_load';
  addresses: string[];
  raw: string;
  span: SourceSpan;
}

export interface IoStoreStmtAst {
  kind: 'io_store';
  addresses: string[];
  raw: string;
  span: SourceSpan;
}

export interface LimitStmtAst {
  kind: 'limit';
  value: string;
  raw: string;
  span: SourceSpan;
}

export interface AssertStmtAst {
  kind: 'assert';
  at: {
    row: string;
    col: string;
  };
  reg: string;
  equals: string;
  cycle?: string;
  raw: string;
  span: SourceSpan;
}

export type RuntimeStmtAst =
  | IoLoadStmtAst
  | IoStoreStmtAst
  | LimitStmtAst
  | AssertStmtAst;

export interface KernelAst {
  name: string;
  config?: { mask: number; startAddr: number; span: SourceSpan };
  cycles: CycleAst[];
  directives: DeclarationAst[];
  runtime?: RuntimeStmtAst[];
  declarations?: DeclarationAst[];
  pragmas: PragmaAst[];
  advancedStatements?: AdvancedStmtAst[];
  span: SourceSpan;
}

export interface AstProgram {
  target?: TargetAst | null;
  targetProfileId: string | null;
  build?: BuildConfigAst;
  kernel: KernelAst | null;
  span: SourceSpan;
}

export interface StructuredCycleStmtAst {
  kind: 'cycle';
  cycle: CycleAst;
  span: SourceSpan;
}

export interface StructuredAdvancedStmtAst {
  kind: 'advanced';
  name: string;
  args: string;
  text: string;
  namespace?: 'std' | null;
  sourceForm?: 'qualified' | 'unqualified';
  label?: string;
  span: SourceSpan;
}

export interface StructuredForStmtAst {
  kind: 'for';
  header: string;
  label?: string;
  body: StructuredKernelStmtAst[];
  span: SourceSpan;
}

export interface StructuredIfStmtAst {
  kind: 'if';
  condition: string;
  control: { row: number; col: number };
  label?: string;
  thenBody: StructuredKernelStmtAst[];
  elseBody?: StructuredKernelStmtAst[];
  span: SourceSpan;
}

export interface StructuredWhileStmtAst {
  kind: 'while';
  condition: string;
  control: { row: number; col: number };
  label?: string;
  body: StructuredKernelStmtAst[];
  span: SourceSpan;
}

export interface StructuredFnCallStmtAst {
  kind: 'fn-call';
  name: string;
  args: string[];
  label?: string;
  span: SourceSpan;
}

export interface StructuredBreakStmtAst {
  kind: 'break';
  targetLabel?: string;
  span: SourceSpan;
}

export interface StructuredContinueStmtAst {
  kind: 'continue';
  targetLabel?: string;
  span: SourceSpan;
}

export interface StructuredFunctionDefAst {
  name: string;
  params: string[];
  body: StructuredKernelStmtAst[];
  span: SourceSpan;
  isMacro?: boolean;
}

export type StructuredKernelStmtAst =
  | StructuredCycleStmtAst
  | StructuredAdvancedStmtAst
  | StructuredForStmtAst
  | StructuredIfStmtAst
  | StructuredWhileStmtAst
  | StructuredFnCallStmtAst
  | StructuredBreakStmtAst
  | StructuredContinueStmtAst;

export interface StructuredKernelAst {
  name: string;
  config?: { mask: number; startAddr: number; span: SourceSpan };
  directives: DeclarationAst[];
  runtime?: RuntimeStmtAst[];
  body: StructuredKernelStmtAst[];
  span: SourceSpan;
}

export interface StructuredProgramAst {
  target?: TargetAst | null;
  targetProfileId: string | null;
  build?: BuildConfigAst;
  kernel: StructuredKernelAst | null;
  functions: StructuredFunctionDefAst[];
  span: SourceSpan;
}
