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
  handleMulaccChain,
  handleCarryChain,
  handleCollect,
  handleConditionalSub,
  handleExtractBytes,
  handleGather,
  handleGuard,
  handleStash,
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
  'no_fuse',
  'latency_hide'
]);

export const SUPPORTED_PRAGMAS = new Set<string>([
  ...NOOP_PRAGMAS,
  'route',
  'broadcast',
  'accumulate',
  'mulacc_chain',
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
  'stash',
  'stream_load',
  'stream_store',
  'latency_hide'
]);

export const PRAGMA_HANDLERS = new Map<string, PragmaHandler>([
  ['route', handleRoute],
  ['broadcast', handleBroadcast],
  ['accumulate', handleAccumulate],
  ['mulacc_chain', handleMulaccChain],
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
  ['stash', handleStash],
  ['stream_load', handleStreamLoad],
  ['stream_store', handleStreamStore]
]);
