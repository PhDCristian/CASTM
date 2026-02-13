import {
  PragmaHandler
} from './types.js';
import {
  handleBroadcast,
  handleRoute
} from './handlers-route-broadcast.js';
import {
  handleAllreduce,
  handleAccumulate,
  handleCarryChain,
  handleCollect,
  handleConditionalSub,
  handleExtractBytes,
  handleGather,
  handleGuard,
  handleNormalize,
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
  'accumulate',
  'carry_chain',
  'conditional_sub',
  'collect',
  'extract_bytes',
  'normalize',
  'rotate',
  'shift',
  'scan',
  'reduce',
  'stencil',
  'guard',
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
  ['accumulate', handleAccumulate],
  ['carry_chain', handleCarryChain],
  ['conditional_sub', handleConditionalSub],
  ['collect', handleCollect],
  ['extract_bytes', handleExtractBytes],
  ['normalize', handleNormalize],
  ['rotate', handleRotateShift],
  ['shift', handleRotateShift],
  ['scan', handleScan],
  ['reduce', handleReduce],
  ['stencil', handleStencil],
  ['guard', handleGuard],
  ['triangle', handleTriangle],
  ['allreduce', handleAllreduce],
  ['transpose', handleTranspose],
  ['gather', handleGather],
  ['stream_load', handleStreamLoad],
  ['stream_store', handleStreamStore]
]);
