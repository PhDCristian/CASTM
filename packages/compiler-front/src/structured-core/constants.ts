export const ADVANCED_NAMES = new Set([
  'route',
  'broadcast',
  'accumulate',
  'mulacc_chain',
  'carry_chain',
  'conditional_sub',
  'collect',
  'stash',
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
  'stream_store',
  'latency_hide'
]);

/**
 * Regex source for an identifier that may contain `{var}` interpolation
 * placeholders for use in labels inside static for loops.
 * Matches: `label`, `label_{i}`, `outer_{i}_inner_{j}`, etc.
 */
export const INTERPOLATED_IDENT = String.raw`[A-Za-z_](?:[A-Za-z0-9_]|\{[A-Za-z_][A-Za-z0-9_]*\})*`;

export const RESERVED_KEYWORDS = new Set([
  'if',
  'while',
  'for',
  'break',
  'continue',
  'cycle',
  'at',
  'pipeline',
  'target',
  'kernel',
  'let',
  'macro'
]);
