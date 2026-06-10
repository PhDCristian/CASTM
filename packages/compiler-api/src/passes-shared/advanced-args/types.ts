import { RoutePoint } from '../route-args.js';

export interface BroadcastAdvancedStatementArgs {
  valueReg: string;
  from: RoutePoint;
  scope: 'row' | 'column' | 'all';
}

export interface CollectAxisRef {
  axis: 'row' | 'col';
  index: number;
}

export interface CollectAdvancedStatementArgs {
  from: CollectAxisRef;
  to: CollectAxisRef;
  viaReg: string;
  localReg: string;
  destReg: string;
  path: 'single_hop' | 'multi_hop';
  maxHops?: number;
  combine: 'copy' | 'add' | 'sum' | 'sub' | 'and' | 'or' | 'xor' | 'mul' | 'shift_add';
}

export interface AccumulateAdvancedStatementArgs {
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

export interface MulaccChainAdvancedStatementArgs {
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

export interface ConditionalSubAdvancedStatementArgs {
  valueReg: string;
  subReg: string;
  destReg: string;
  target: ConditionalSubTarget;
}

export interface CarryChainAdvancedStatementArgs {
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

export interface NormalizeAdvancedStatementArgs {
  reg: string;
  carryReg: string;
  width: number;
  mask: number;
  axis: 'row' | 'col';
  lane: number;
  direction: 'left' | 'right' | 'up' | 'down';
}

export interface ExtractBytesAdvancedStatementArgs {
  srcReg: string;
  destReg: string;
  axis: 'row' | 'col';
  byteWidth: number;
  mask: number;
}

export interface RotateShiftAdvancedStatementArgs {
  reg: string;
  direction: 'left' | 'right';
  distance: number;
  fill?: number;
}

export interface ScanAdvancedStatementArgs {
  operation: string;
  srcReg: string;
  dstReg: string;
  direction: 'left' | 'right' | 'up' | 'down';
  mode: 'inclusive' | 'exclusive';
}

export interface ReduceAdvancedStatementArgs {
  operation: string;
  destReg: string;
  srcReg: string;
  axis: 'row' | 'col';
}

export interface StencilAdvancedStatementArgs {
  pattern: 'cross' | 'horizontal' | 'vertical';
  operation: string;
  srcReg: string;
  destReg: string;
}

export interface TriangleAdvancedStatementArgs {
  shape: 'upper' | 'lower';
  inclusive: boolean;
  opcode: string;
  destReg: string;
  srcA: string;
  srcB: string;
}

export interface GuardAdvancedStatementArgs {
  condition: string;
  opcode: string;
  destReg: string;
  srcA: string;
  srcB: string;
}

export interface AllreduceAdvancedStatementArgs {
  operation: string;
  destReg: string;
  srcReg: string;
  axis: 'row' | 'col';
}

export interface TransposeAdvancedStatementArgs {
  reg: string;
}

export interface GatherAdvancedStatementArgs {
  srcReg: string;
  dest: RoutePoint;
  destReg: string;
  operation: string;
}

export interface StreamLoadAdvancedStatementArgs {
  destReg: string;
  row: number;
  count: number;
}

export interface StreamStoreAdvancedStatementArgs {
  srcReg: string;
  row: number;
  count: number;
}

export interface LatencyHideAdvancedStatementArgs {
  window: number;
  mode: 'conservative';
}

export type StashTarget =
  | { kind: 'all' }
  | { kind: 'row'; index: number }
  | { kind: 'col'; index: number }
  | { kind: 'point'; row: number; col: number };

export interface StashAdvancedStatementArgs {
  action: 'save' | 'restore';
  reg: string;
  addr: string;
  target: StashTarget;
}
