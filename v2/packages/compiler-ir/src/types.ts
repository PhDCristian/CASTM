export type Topology = 'torus' | 'mesh';
export type WrapPolicy = 'wrap' | 'clamp';

export interface SourceSpan {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface DiagnosticRelated {
  span: SourceSpan;
  message: string;
}

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  span: SourceSpan;
  message: string;
  hint?: string;
  related?: DiagnosticRelated[];
}

export interface GridSpec {
  rows: number;
  cols: number;
  topology: Topology;
  wrapPolicy: WrapPolicy;
}

export interface TargetProfile {
  id: string;
  description: string;
  grid: GridSpec;
  registers: string[];
  neighbors: string[];
}

export interface MemoryRegionInfo {
  name?: string;
  start: number;
  values: number[];
}

export interface CompileOptions {
  targetProfile?: string;
  grid?: Partial<Pick<GridSpec, 'rows' | 'cols' | 'topology'>>;
  emitArtifacts?: Array<'ast' | 'hir' | 'mir' | 'csv'>;
}

export interface EmitOptions {
  includeCycleHeader?: boolean;
}

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
  statements: CycleStatementAst[];
  span: SourceSpan;
}

export interface DirectiveAst {
  kind: 'const' | 'alias' | 'data' | 'raw';
  name: string;
  value: string;
  span: SourceSpan;
}

export interface KernelAst {
  name: string;
  config?: { mask: number; startAddr: number; span: SourceSpan };
  cycles: CycleAst[];
  directives: DirectiveAst[];
  pragmas: string[];
  span: SourceSpan;
}

export interface AstProgram {
  targetProfileId: string | null;
  kernel: KernelAst | null;
  span: SourceSpan;
}

export interface HirOperation {
  row: number;
  col: number;
  opcode: string;
  operands: string[];
  span: SourceSpan;
}

export interface HirCycle {
  index: number;
  operations: HirOperation[];
  span: SourceSpan;
}

export interface HirProgram {
  targetProfileId: string;
  grid: GridSpec;
  cycles: HirCycle[];
}

export interface MirInstruction {
  opcode: string;
  operands: string[];
  span: SourceSpan;
}

export interface MirSlot {
  row: number;
  col: number;
  instruction: MirInstruction;
}

export interface MirCycle {
  index: number;
  slots: MirSlot[];
}

export interface MirProgram {
  targetProfileId: string;
  grid: GridSpec;
  cycles: MirCycle[];
}

export interface ParseResult {
  success: boolean;
  ast?: AstProgram;
  diagnostics: Diagnostic[];
}

export interface AnalysisResult {
  success: boolean;
  diagnostics: Diagnostic[];
  ast?: AstProgram;
  hir?: HirProgram;
  mir?: MirProgram;
  memoryRegions?: MemoryRegionInfo[];
  loweredPasses: string[];
}

export interface CompileResult {
  success: boolean;
  diagnostics: Diagnostic[];
  artifacts: {
    csv?: string;
    ast?: AstProgram;
    hir?: HirProgram;
    mir?: MirProgram;
    memoryRegions?: MemoryRegionInfo[];
  };
  stats: {
    cycles: number;
    instructions: number;
    loweredPasses: string[];
  };
}

export interface EmitResult {
  success: boolean;
  diagnostics: Diagnostic[];
  csv?: string;
}
