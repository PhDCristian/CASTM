import { SourceSpan } from './common.js';
import type { ExpansionMode } from './options.js';

export interface InstructionAst {
  text: string;
  opcode: string | null;
  operands: string[];
  span: SourceSpan;
}

export interface BundleStmtAt {
  kind: 'at';
  row: number;
  col: number;
  instruction: InstructionAst;
  span: SourceSpan;
}

export interface BundleStmtAtExpr {
  kind: 'at-expr';
  rowExpr: string;
  colExpr: string;
  instruction: InstructionAst;
  span: SourceSpan;
}

export interface BundleStmtRow {
  kind: 'row';
  row: number;
  instructions: InstructionAst[];
  span: SourceSpan;
}

export interface BundleStmtCol {
  kind: 'col';
  col: number;
  instruction: InstructionAst;
  span: SourceSpan;
}

export interface BundleStmtAll {
  kind: 'all';
  instruction: InstructionAst;
  span: SourceSpan;
}

export type BundleStatementAst = BundleStmtAt | BundleStmtAtExpr | BundleStmtRow | BundleStmtCol | BundleStmtAll;

export interface BundleAst {
  index: number;
  label?: string;
  statements: BundleStatementAst[];
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
  pruneNoopBundles?: boolean;
  grid?: {
    rows: number;
    cols: number;
    topology?: BuildTopology;
  };
  span: SourceSpan;
}

export interface AdvancedStatementAst {
  text: string;
  anchorBundleIndex?: number;
  label?: string;
  span: SourceSpan;
}

export interface RuntimeForAst {
  variable: string;
  range: { start: string; end: string; step?: string };
  control: { row: string; col: string };
  span: SourceSpan;
}

export type SpatialStmtAst = BundleStatementAst;

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
  bundle?: string;
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
  bundles: BundleAst[];
  directives: DeclarationAst[];
  runtime?: RuntimeStmtAst[];
  declarations?: DeclarationAst[];
  advancedStatements: AdvancedStatementAst[];
  span: SourceSpan;
}

export interface AstProgram {
  target?: TargetAst | null;
  targetProfileId: string | null;
  build?: BuildConfigAst;
  kernel: KernelAst | null;
  span: SourceSpan;
}

export interface StructuredBundleStmtAst {
  kind: 'bundle';
  bundle: BundleAst;
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
  | StructuredBundleStmtAst
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
