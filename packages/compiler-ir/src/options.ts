import { GridSpec } from './common.js';

export interface CompileOptions {
  targetProfile?: string;
  grid?: Partial<Pick<GridSpec, 'rows' | 'cols' | 'topology'>>;
  emitArtifacts?: Array<'structured' | 'ast' | 'hir' | 'mir' | 'lir' | 'csv'>;
  strictUnsupported?: boolean;
  schedulerMode?: 'safe' | 'balanced' | 'aggressive';
  schedulerWindow?: number;
  memoryReorderPolicy?: 'strict' | 'same-address-fence';
  pruneNoopCycles?: boolean;
}

export interface EmitOptions {
  includeCycleHeader?: boolean;
  format?: 'flat-csv' | 'sim-matrix-csv';
}
