/**
 * Metrics Delta Utility
 * 
 * Compares compilation metrics between runs and shows delta.
 */

import chalk from 'chalk';

export interface CompileMetrics {
  cycles: number;
  instructions: number;
  peUsed: number;
  peTotal: number;
  memoryOps: number;
  memoryBytes: number;
  compileTimeMs: number;
}

export interface MetricsDelta {
  cycles: number;
  instructions: number;
  peUtilization: number;  // Percentage change
  memoryOps: number;
  memoryBytes: number;
  compileTimeMs: number;
  hasChanges: boolean;
}

/**
 * Calculate delta between two metric sets
 */
export function calculateMetricsDelta(
  oldMetrics: CompileMetrics | null,
  newMetrics: CompileMetrics
): MetricsDelta {
  if (!oldMetrics) {
    return {
      cycles: 0,
      instructions: 0,
      peUtilization: 0,
      memoryOps: 0,
      memoryBytes: 0,
      compileTimeMs: 0,
      hasChanges: false,
    };
  }

  const oldPeUtil = oldMetrics.peTotal > 0 ? (oldMetrics.peUsed / oldMetrics.peTotal) * 100 : 0;
  const newPeUtil = newMetrics.peTotal > 0 ? (newMetrics.peUsed / newMetrics.peTotal) * 100 : 0;

  const delta: MetricsDelta = {
    cycles: newMetrics.cycles - oldMetrics.cycles,
    instructions: newMetrics.instructions - oldMetrics.instructions,
    peUtilization: newPeUtil - oldPeUtil,
    memoryOps: newMetrics.memoryOps - oldMetrics.memoryOps,
    memoryBytes: newMetrics.memoryBytes - oldMetrics.memoryBytes,
    compileTimeMs: newMetrics.compileTimeMs - oldMetrics.compileTimeMs,
    hasChanges: false,
  };

  delta.hasChanges = delta.cycles !== 0 || 
                     delta.instructions !== 0 || 
                     delta.memoryOps !== 0;

  return delta;
}

/**
 * Format a delta value with arrow and color
 */
function formatDelta(value: number, unit: string = '', inverse: boolean = false): string {
  if (value === 0) {
    return chalk.dim(`= ${unit}`);
  }

  const isPositive = value > 0;
  // For some metrics (like cycles), lower is better (inverse = true)
  const isGood = inverse ? !isPositive : isPositive;
  const arrow = isPositive ? '↑' : '↓';
  const color = isGood ? chalk.green : chalk.red;
  const sign = isPositive ? '+' : '';

  return color(`${arrow} ${sign}${value}${unit}`);
}

/**
 * Format a percentage delta
 */
function formatPercentDelta(value: number, inverse: boolean = false): string {
  if (Math.abs(value) < 0.1) {
    return chalk.dim('= ');
  }

  const isPositive = value > 0;
  const isGood = inverse ? !isPositive : isPositive;
  const arrow = isPositive ? '↑' : '↓';
  const color = isGood ? chalk.green : chalk.red;
  const sign = isPositive ? '+' : '';

  return color(`${arrow} ${sign}${value.toFixed(1)}%`);
}

/**
 * Format metrics with current values and deltas
 */
export function formatMetrics(
  metrics: CompileMetrics,
  delta: MetricsDelta
): string {
  const lines: string[] = [];
  const peUtil = metrics.peTotal > 0 
    ? ((metrics.peUsed / metrics.peTotal) * 100).toFixed(0) 
    : '0';

  // Cycles (lower is better)
  lines.push(
    `  ${chalk.dim('cycles')}      ${chalk.white(metrics.cycles)} ${formatDelta(delta.cycles, '', true)}`
  );

  // Instructions
  lines.push(
    `  ${chalk.dim('instrs')}      ${chalk.white(metrics.instructions)} ${formatDelta(delta.instructions, '')}`
  );

  // PE Utilization (higher is better)
  lines.push(
    `  ${chalk.dim('PE usage')}    ${chalk.white(peUtil + '%')} (${metrics.peUsed}/${metrics.peTotal}) ${formatPercentDelta(delta.peUtilization, false)}`
  );

  // Memory operations
  lines.push(
    `  ${chalk.dim('mem ops')}     ${chalk.white(metrics.memoryOps)} ${formatDelta(delta.memoryOps, '')}`
  );

  // Compile time (lower is better)
  lines.push(
    `  ${chalk.dim('compile')}     ${chalk.white(metrics.compileTimeMs.toFixed(0) + 'ms')} ${formatDelta(Math.round(delta.compileTimeMs), 'ms', true)}`
  );

  return lines.join('\n');
}

/**
 * Format compact metrics summary
 */
export function formatMetricsSummary(
  metrics: CompileMetrics,
  delta: MetricsDelta
): string {
  const parts: string[] = [];

  // Cycles
  parts.push(`${metrics.cycles}cy`);
  if (delta.cycles !== 0) {
    const color = delta.cycles < 0 ? chalk.green : chalk.red;
    const sign = delta.cycles > 0 ? '+' : '';
    parts.push(color(`(${sign}${delta.cycles})`));
  }

  // PE usage
  const peUtil = metrics.peTotal > 0 
    ? ((metrics.peUsed / metrics.peTotal) * 100).toFixed(0) 
    : '0';
  parts.push(`${peUtil}%PE`);

  return parts.join(' ');
}

/**
 * Extract metrics from compilation result
 */
export function extractMetrics(
  result: {
    csv?: string;
    maxCycles?: number;
    suggestedGridSize?: { width: number; height: number };
    memoryRegions?: { values: number[] }[];
  },
  compileTimeMs: number
): CompileMetrics {
  // Count instructions from CSV
  const csvLines = result.csv?.split('\n').filter(l => l.trim() && !l.startsWith('#')) || [];
  const instructions = csvLines.length;

  // Calculate PE usage from CSV
  const peSet = new Set<string>();
  for (const line of csvLines) {
    // CSV format has PE coordinates in first columns
    const parts = line.split(',');
    if (parts.length >= 2) {
      peSet.add(`${parts[0]},${parts[1]}`);
    }
  }

  const gridSize = result.suggestedGridSize || { width: 4, height: 4 };
  const peTotal = gridSize.width * gridSize.height;

  // Count memory operations
  let memoryOps = 0;
  let memoryBytes = 0;
  for (const line of csvLines) {
    if (line.includes('LWI') || line.includes('SWI') || line.includes('LW') || line.includes('SW')) {
      memoryOps++;
    }
  }

  // Calculate memory from regions
  for (const region of result.memoryRegions || []) {
    memoryBytes += region.values.length * 4; // 32-bit words
  }

  return {
    cycles: result.maxCycles || csvLines.length,
    instructions,
    peUsed: peSet.size,
    peTotal,
    memoryOps,
    memoryBytes,
    compileTimeMs,
  };
}
