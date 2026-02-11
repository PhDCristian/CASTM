import { GridSpec } from './common.js';

export interface CompileOptions {
  targetProfile?: string;
  grid?: Partial<Pick<GridSpec, 'rows' | 'cols' | 'topology'>>;
  emitArtifacts?: Array<'structured' | 'ast' | 'hir' | 'mir' | 'lir' | 'csv'>;
  strictUnsupported?: boolean;
}

export interface EmitOptions {
  includeCycleHeader?: boolean;
  format?: 'flat-csv' | 'sim-matrix-csv';
}
