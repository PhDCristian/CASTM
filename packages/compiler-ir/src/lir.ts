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

export interface Lirbundle {
  index: number;
  slots: LirSlot[];
}

export interface LirProgram {
  targetProfileId: string;
  grid: GridSpec;
  cycles: LirCycle[];
}
