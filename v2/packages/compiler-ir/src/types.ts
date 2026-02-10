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
  rows?: number;
  cols?: number;
}

export interface IoConfigInfo {
  loadAddrs: number[];
  storeAddrs: number[];
}

export interface AssertionInfo {
  cycle?: number;
  row?: number;
  col?: number;
  register?: string;
  value?: number;
  raw: string;
  span: SourceSpan;
}

export interface SymbolArrayInfo {
  name: string;
  start: number;
  length: number;
  rows?: number;
  cols?: number;
}

export interface SymbolInfo {
  constants: Record<string, string>;
  aliases: Record<string, string>;
  arrays: SymbolArrayInfo[];
  labels: Record<string, number>;
}

export interface CompileOptions {
  targetProfile?: string;
  grid?: Partial<Pick<GridSpec, 'rows' | 'cols' | 'topology'>>;
  emitArtifacts?: Array<'ast' | 'hir' | 'mir' | 'lir' | 'csv'>;
  strictUnsupported?: boolean;
}

export interface EmitOptions {
  includeCycleHeader?: boolean;
  format?: 'flat-csv' | 'sim-matrix-csv';
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

export interface PragmaAst {
  text: string;
  span: SourceSpan;
}

export interface KernelAst {
  name: string;
  config?: { mask: number; startAddr: number; span: SourceSpan };
  cycles: CycleAst[];
  directives: DirectiveAst[];
  pragmas: PragmaAst[];
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

export interface LirInstruction {
  opcode: string;
  operands: string[];
  span: SourceSpan;
}

export interface LirSlot {
  row: number;
  col: number;
  instruction: LirInstruction;
}

export interface LirCycle {
  index: number;
  slots: LirSlot[];
}

export interface LirProgram {
  targetProfileId: string;
  grid: GridSpec;
  cycles: LirCycle[];
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
  lir?: LirProgram;
  memoryRegions?: MemoryRegionInfo[];
  ioConfig?: IoConfigInfo;
  cycleLimit?: number;
  assertions?: AssertionInfo[];
  symbols?: SymbolInfo;
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
    lir?: LirProgram;
    memoryRegions?: MemoryRegionInfo[];
    ioConfig?: IoConfigInfo;
    cycleLimit?: number;
    assertions?: AssertionInfo[];
    symbols?: SymbolInfo;
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
