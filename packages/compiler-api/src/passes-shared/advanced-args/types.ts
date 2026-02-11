import { RoutePoint } from '../route-args.js';

export interface BroadcastPragmaArgs {
  valueReg: string;
  from: RoutePoint;
  scope: 'row' | 'column' | 'all';
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
