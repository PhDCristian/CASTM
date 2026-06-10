import { GridSpec, SourceSpan } from './common.js';

export interface MirInstruction {
  opcode: string;
  operands: string[];
  span: SourceSpan;
}

export interface MirSlot {
  row: number;
  col: number;
  instruction: MirInstruction;
}

export interface MirBundle {
  index: number;
  slots: MirSlot[];
}

export interface MirProgram {
  targetProfileId: string;
  grid: GridSpec;
  bundles: MirBundle[];
}
