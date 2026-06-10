import { GridSpec, SourceSpan } from './common.js';

export interface HirOperation {
  row: number;
  col: number;
  opcode: string;
  operands: string[];
  span: SourceSpan;
}

export interface HirBundle {
  index: number;
  operations: HirOperation[];
  span: SourceSpan;
}

export interface HirProgram {
  targetProfileId: string;
  grid: GridSpec;
  bundles: HirBundle[];
}
