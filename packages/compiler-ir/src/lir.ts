import { GridSpec, SourceSpan } from './common.js';

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

export interface LirBundle {
  index: number;
  slots: LirSlot[];
}

export interface LirProgram {
  targetProfileId: string;
  grid: GridSpec;
  bundles: LirBundle[];
}
