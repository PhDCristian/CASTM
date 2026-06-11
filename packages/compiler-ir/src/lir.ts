import { GridSpec, SourceSpan } from './common.js';
import type { CastmSlotSource } from './source-map.js';

export interface LirInstruction {
  opcode: string;
  operands: string[];
  span: SourceSpan;
}

export interface LirSlot {
  row: number;
  col: number;
  instruction: LirInstruction;
  source?: CastmSlotSource;
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
