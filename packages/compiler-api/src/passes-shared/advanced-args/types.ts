import { RoutePoint } from '../route-args.js';

export interface BroadcastPragmaArgs {
  valueReg: string;
  from: RoutePoint;
  scope: 'row' | 'column' | 'all';
}

export interface CollectAxisRef {
  axis: 'row' | 'col';
  index: number;
}

export interface CollectPragmaArgs {
  from: CollectAxisRef;
  to: CollectAxisRef;
  viaReg: string;
  localReg: string;
  destReg: string;
  combine: 'copy' | 'add' | 'sum' | 'sub' | 'and' | 'or' | 'xor' | 'mul' | 'shift_add';
}

export interface RotateShiftPragmaArgs {
  reg: string;
  direction: 'left' | 'right';
  distance: number;
  fill?: number;
}

export interface ScanPragmaArgs {
  operation: string;
  srcReg: string;
  dstReg: string;
  direction: 'left' | 'right' | 'up' | 'down';
  mode: 'inclusive' | 'exclusive';
}

export interface ReducePragmaArgs {
  operation: string;
  destReg: string;
  srcReg: string;
  axis: 'row' | 'col';
}

export interface StencilPragmaArgs {
  pattern: 'cross' | 'horizontal' | 'vertical';
  operation: string;
  srcReg: string;
  destReg: string;
}

export interface TrianglePragmaArgs {
  shape: 'upper' | 'lower';
  inclusive: boolean;
  opcode: string;
  destReg: string;
  srcA: string;
  srcB: string;
}

export interface GuardPragmaArgs {
  condition: string;
  opcode: string;
  destReg: string;
  srcA: string;
  srcB: string;
}

export interface AllreducePragmaArgs {
  operation: string;
  destReg: string;
  srcReg: string;
  axis: 'row' | 'col';
}

export interface TransposePragmaArgs {
  reg: string;
}

export interface GatherPragmaArgs {
  srcReg: string;
  dest: RoutePoint;
  destReg: string;
  operation: string;
}

export interface StreamLoadPragmaArgs {
  destReg: string;
  row: number;
  count: number;
}

export interface StreamStorePragmaArgs {
  srcReg: string;
  row: number;
  count: number;
}
