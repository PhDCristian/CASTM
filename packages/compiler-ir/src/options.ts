export type ExpansionMode = 'full-unroll' | 'jump-reuse';

export interface CompileOptions {
  emitArtifacts?: Array<'structured' | 'ast' | 'hir' | 'mir' | 'lir' | 'csv'>;
  strictUnsupported?: boolean;
  expansionMode?: ExpansionMode;
  /** Resolve an include path relative to the source file and return the file contents. */
  resolveInclude?: (path: string) => string | null;
}

export interface EmitOptions {
  includeCycleHeader?: boolean;
  format?: 'flat-csv' | 'sim-matrix-csv';
}
