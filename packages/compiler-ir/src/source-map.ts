import { GridSpec, SourceSpan } from './common.js';

export type CastmSlotOriginKind =
  | 'direct'
  | 'range-expanded'
  | 'at-all-expanded'
  | 'row-expanded'
  | 'col-expanded'
  | 'for-expanded'
  | 'function-expanded'
  | 'std-expanded'
  | 'scheduled'
  | 'synthetic'
  | 'multi-origin';

export type CastmEditPolicy =
  | 'direct-editable'
  | 'canonicalize-region'
  | 'materialization-required'
  | 'readonly-generated'
  | 'conflict';

export interface CastmSlotSource {
  stableBundleId: string;
  stableSlotId: string;
  originKind: CastmSlotOriginKind;
  editPolicy: CastmEditPolicy;
  originSpan: SourceSpan;
  instructionSpan: SourceSpan;
  humanAuthored: boolean;
  astPath?: string;
  bundlePath?: string;
  origins?: Array<Omit<CastmSlotSource, 'origins'>>;
}

export interface CastmSourceMapEntry {
  stableBundleId: string;
  stableSlotId: string;
  bundle: number;
  row: number;
  col: number;
  instruction: string;
  source: CastmSlotSource;
  emit?: {
    format: 'flat-csv' | 'sim-matrix-csv';
    line: number;
    column: number;
  };
}

export interface CastmSourceMap {
  version: 1;
  targetProfileId: string;
  grid: GridSpec;
  entries: CastmSourceMapEntry[];
}
