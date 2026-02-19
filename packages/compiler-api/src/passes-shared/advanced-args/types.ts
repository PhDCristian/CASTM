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
  path: 'single_hop' | 'multi_hop';
  maxHops?: number;
  combine: 'copy' | 'add' | 'sum' | 'sub' | 'and' | 'or' | 'xor' | 'mul' | 'shift_add';
}

export interface AccumulatePragmaArgs {
  pattern: 'row' | 'col' | 'anti_diagonal';
  productsReg: string;
  accumReg: string;
  outReg: string;
  combine: 'add' | 'sum' | 'sub' | 'and' | 'or' | 'xor' | 'mul';
  steps: number;
  scope?: { kind: 'all' } | { kind: 'row'; index: number } | { kind: 'col'; index: number };
}

export type MulaccChainTarget =
  | { kind: 'all' }
  | { kind: 'row'; index: number }
  | { kind: 'col'; index: number };

export interface MulaccChainPragmaArgs {
  srcReg: string;
  coeffReg: string;
  accReg: string;
  outReg: string;
  target: MulaccChainTarget;
  lanes?: number;
  width: number;
  mask: number;
  direction: 'left' | 'right' | 'up' | 'down';
}

export type ConditionalSubTarget =
  | { kind: 'all' }
  | { kind: 'row'; index: number }
  | { kind: 'col'; index: number }
  | { kind: 'point'; row: number; col: number };

export interface ConditionalSubPragmaArgs {
  valueReg: string;
  subReg: string;
  destReg: string;
  target: ConditionalSubTarget;
}

export interface CarryChainPragmaArgs {
  srcReg: string;
  carryReg: string;
  storeSymbol: string;
  limbs: number;
  width: number;
  mask: number;
  row: number;
  startCol: number;
  direction: 'right' | 'left';
}

export interface NormalizePragmaArgs {
  reg: string;
  carryReg: string;
  width: number;
  mask: number;
  axis: 'row' | 'col';
  lane: number;
  direction: 'left' | 'right' | 'up' | 'down';
}

export interface ExtractBytesPragmaArgs {
  srcReg: string;
  destReg: string;
  axis: 'row' | 'col';
  byteWidth: number;
  mask: number;
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

export interface LatencyHidePragmaArgs {
  window: number;
  mode: 'conservative';
}

export type StashTarget =
  | { kind: 'all' }
  | { kind: 'row'; index: number }
  | { kind: 'col'; index: number }
  | { kind: 'point'; row: number; col: number };

export interface StashPragmaArgs {
  action: 'save' | 'restore';
  reg: string;
  addr: string;
  target: StashTarget;
}
