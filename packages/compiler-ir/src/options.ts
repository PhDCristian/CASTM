export type ExpansionMode = 'full-unroll' | 'jump-reuse';

export interface CompileOptions {
  emitArtifacts?: Array<'structured' | 'ast' | 'hir' | 'mir' | 'lir' | 'csv'>;
  strictUnsupported?: boolean;
  expansionMode?: ExpansionMode;
}

export interface EmitOptions {
  includeCycleHeader?: boolean;
  format?: 'flat-csv' | 'sim-matrix-csv';
}
