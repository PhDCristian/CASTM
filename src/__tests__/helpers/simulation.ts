/**
 * Simulation Test Helper
 *
 * Wraps the UMA-CGRA-Simulator API for easy use in tests.
 * Provides compile → parse → simulate → extract pipeline.
 */

import { compileDslToCsv, type CompilationResult, type MemoryRegionInfo } from '../../compiler';
import { parseProgram } from '@core/simulation/instruction';
import type { CycleProgram } from '@core/simulation/instruction';
import {
  runSimulation,
  type SimulationResult,
  type SimulationOptions,
  type MemoryRegion,
  type CycleState,
  type PEState
} from '@core/simulation/simulation';

export type { SimulationResult, MemoryRegion, CycleState, PEState, CompilationResult };

/**
 * Compile DSL code, parse the CSV, and run the simulation.
 * Automatically passes compiled memory regions and IO config to the simulator.
 */
export function compileAndSimulate(
  dslCode: string,
  options?: {
    memoryRegions?: MemoryRegion[];
    limit?: number;
  }
): SimulationResult {
  const result = compileDslToCsv(dslCode);
  if (!result.success || !result.csv) {
    throw new Error(`Compilation failed: ${JSON.stringify(result.errors ?? result.error)}`);
  }

  const program = parseProgram(result.csv);

  // Build memory regions from compilation result + any overrides
  const memRegions: MemoryRegion[] = [];

  // Add compiler-generated memory regions (from .data directives)
  if (result.memoryRegions) {
    for (const region of result.memoryRegions) {
      memRegions.push({
        start: region.start,
        values: region.values,
        name: region.name,
      });
    }
  }

  // Add/override with user-provided memory regions
  if (options?.memoryRegions) {
    memRegions.push(...options.memoryRegions);
  }

  const simResult = runSimulation({
    program,
    memoryRegions: memRegions,
    loadAddrs: result.ioConfig?.loadAddrs ?? [],
    storeAddrs: result.ioConfig?.storeAddrs ?? [],
    limit: options?.limit ?? 300,
  });

  return simResult;
}

/**
 * Get the final cycle state from a simulation result.
 */
export function getFinalState(result: SimulationResult): CycleState {
  const state = result.state;
  if (!state || state.length === 0) {
    throw new Error('Simulation produced no states');
  }
  return state[state.length - 1];
}

/**
 * Get a PE's register value from the final simulation state.
 */
export function getRegister(
  result: SimulationResult,
  row: number,
  col: number,
  reg: string
): number {
  const finalState = getFinalState(result);
  const pe = finalState.grid[row]?.[col];
  if (!pe) {
    throw new Error(`PE(${row},${col}) not found in grid`);
  }
  return pe.registers[reg] ?? 0;
}

/**
 * Get a memory value at a given word address from the final state.
 * Word address = byte address / 4.
 */
export function getMemoryWord(
  result: SimulationResult,
  wordAddress: number
): number {
  const finalState = getFinalState(result);
  return finalState.memory[wordAddress] ?? 0;
}

/**
 * Get multiple memory words starting from a word address.
 */
export function getMemoryRange(
  result: SimulationResult,
  startWordAddress: number,
  count: number
): number[] {
  const finalState = getFinalState(result);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(finalState.memory[startWordAddress + i] ?? 0);
  }
  return values;
}
