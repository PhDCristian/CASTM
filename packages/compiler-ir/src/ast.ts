import { SourceSpan } from './common.js';

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

export type CycleStatementAst = CycleStmtAt | CycleStmtRow | CycleStmtCol | CycleStmtAll;

export interface CycleAst {
  index: number;
  label?: string;
  statements: CycleStatementAst[];
  span: SourceSpan;
}

export interface DirectiveAst {
  kind: 'const' | 'alias' | 'data' | 'data2d' | 'raw';
  name: string;
  value: string;
  span: SourceSpan;
}

export interface DeclarationAst {
  kind: 'const' | 'alias' | 'data' | 'data2d' | 'io_load' | 'io_store' | 'limit' | 'assert';
  name: string;
  value: string;
  span: SourceSpan;
}

export interface PragmaAst {
  text: string;
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

export interface KernelAst {
  name: string;
  config?: { mask: number; startAddr: number; span: SourceSpan };
  cycles: CycleAst[];
  directives: DirectiveAst[];
  declarations?: DeclarationAst[];
  pragmas: PragmaAst[];
  advancedStatements?: AdvancedStmtAst[];
  span: SourceSpan;
}

export interface AstProgram {
  targetProfileId: string | null;
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
  text: string;
  span: SourceSpan;
}

export interface StructuredForStmtAst {
  kind: 'for';
  header: string;
  body: StructuredKernelStmtAst[];
  span: SourceSpan;
}

export interface StructuredIfStmtAst {
  kind: 'if';
  condition: string;
  control: { row: number; col: number };
  thenBody: StructuredKernelStmtAst[];
  elseBody?: StructuredKernelStmtAst[];
  span: SourceSpan;
}

export interface StructuredWhileStmtAst {
  kind: 'while';
  condition: string;
  control: { row: number; col: number };
  body: StructuredKernelStmtAst[];
  span: SourceSpan;
}

export interface StructuredFnCallStmtAst {
  kind: 'fn-call';
  name: string;
  args: string[];
  span: SourceSpan;
}

export type StructuredKernelStmtAst =
  | StructuredCycleStmtAst
  | StructuredAdvancedStmtAst
  | StructuredForStmtAst
  | StructuredIfStmtAst
  | StructuredWhileStmtAst
  | StructuredFnCallStmtAst;

export interface StructuredKernelAst {
  name: string;
  config?: { mask: number; startAddr: number; span: SourceSpan };
  directives: DirectiveAst[];
  body: StructuredKernelStmtAst[];
  span: SourceSpan;
}

export interface StructuredProgramAst {
  targetProfileId: string | null;
  kernel: StructuredKernelAst | null;
  span: SourceSpan;
}
