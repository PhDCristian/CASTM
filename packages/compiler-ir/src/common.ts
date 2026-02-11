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
  hintCode?: string;
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
