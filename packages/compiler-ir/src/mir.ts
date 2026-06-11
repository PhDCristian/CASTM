import { GridSpec, SourceSpan } from './common.js';
import type { CastmSlotSource } from './source-map.js';

export interface MirInstruction {
  opcode: string;
  operands: string[];
  span: SourceSpan;
}

export interface MirSlot {
  row: number;
  col: number;
  instruction: MirInstruction;
  source?: CastmSlotSource;
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
