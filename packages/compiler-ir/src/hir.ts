import { GridSpec, SourceSpan } from './common.js';

export interface HirOperation {
  row: number;
  col: number;
  opcode: string;
  operands: string[];
  span: SourceSpan;
}

export interface Hirbundle {
  index: number;
  operations: HirOperation[];
  span: SourceSpan;
}

export interface HirProgram {
  targetProfileId: string;
  grid: GridSpec;
  cycles: HirCycle[];
}
