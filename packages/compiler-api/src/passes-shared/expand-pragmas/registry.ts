import {
  PragmaHandler
} from './types.js';
import {
  handleBroadcast,
  handleRoute
} from './handlers-route-broadcast.js';
import {
  handleAllreduce,
  handleGather,
  handleReduce,
  handleScan,
  handleStencil,
  handleTriangle,
  handleTranspose
} from './handlers-collective.js';
import {
  handleRotateShift,
  handleStreamLoad,
  handleStreamStore
} from './handlers-rotate-stream.js';

export const NOOP_PRAGMAS = new Set<string>([
  'unroll',
  'no_unroll',
  'parallel',
  'no_fuse'
]);

export const SUPPORTED_PRAGMAS = new Set<string>([
  ...NOOP_PRAGMAS,
  'route',
  'broadcast',
  'rotate',
  'shift',
  'scan',
  'reduce',
  'stencil',
  'triangle',
  'allreduce',
  'transpose',
  'gather',
  'stream_load',
  'stream_store'
]);

export const PRAGMA_HANDLERS = new Map<string, PragmaHandler>([
  ['route', handleRoute],
  ['broadcast', handleBroadcast],
  ['rotate', handleRotateShift],
  ['shift', handleRotateShift],
  ['scan', handleScan],
  ['reduce', handleReduce],
  ['stencil', handleStencil],
  ['triangle', handleTriangle],
  ['allreduce', handleAllreduce],
  ['transpose', handleTranspose],
  ['gather', handleGather],
  ['stream_load', handleStreamLoad],
  ['stream_store', handleStreamStore]
]);
