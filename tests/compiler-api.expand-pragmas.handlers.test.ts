import { describe, expect, it } from 'vitest';
import {
  ErrorCodes,
  spanAt
} from '@openedge/compiler-ir';
import {
  handleBroadcast,
  handleRoute
} from '../packages/compiler-api/src/passes-shared/expand-pragmas/handlers-route-broadcast.js';
import {
  handleRotateShift,
  handleStreamLoad,
  handleStreamStore
} from '../packages/compiler-api/src/passes-shared/expand-pragmas/handlers-rotate-stream.js';
import {
  handleAllreduce,
  handleGather,
  handleReduce,
  handleScan,
  handleStencil,
  handleTriangle,
  handleTranspose
} from '../packages/compiler-api/src/passes-shared/expand-pragmas/handlers-collective.js';
import {
  NOOP_PRAGMAS,
  PRAGMA_HANDLERS,
  SUPPORTED_PRAGMAS
} from '../packages/compiler-api/src/passes-shared/expand-pragmas/registry.js';

const span = spanAt(1, 1, 1);

const torusGrid: any = {
  rows: 4,
  cols: 4,
  topology: 'torus',
  wrapPolicy: 'wrap'
};

const meshGrid: any = {
  rows: 4,
  cols: 4,
  topology: 'mesh',
  wrapPolicy: 'clamp'
};

function ctx(grid: any = torusGrid) {
  return {
    grid,
    generatedCycles: [] as any[],
    diagnostics: [] as any[]
  };
}

function pragma(text: string) {
  return { text, span };
}

describe('compiler-api expand-pragmas handlers/registry', () => {
  it('exposes supported and noop pragma registries', () => {
    expect(NOOP_PRAGMAS.has('unroll')).toBe(true);
    expect(NOOP_PRAGMAS.has('route')).toBe(false);

    expect(SUPPORTED_PRAGMAS.has('route')).toBe(true);
    expect(SUPPORTED_PRAGMAS.has('stream_store')).toBe(true);
    expect(SUPPORTED_PRAGMAS.has('triangle')).toBe(true);
    expect(SUPPORTED_PRAGMAS.has('unknown')).toBe(false);

    expect(PRAGMA_HANDLERS.get('route')).toBe(handleRoute);
    expect(PRAGMA_HANDLERS.get('broadcast')).toBe(handleBroadcast);
    expect(PRAGMA_HANDLERS.get('rotate')).toBe(handleRotateShift);
    expect(PRAGMA_HANDLERS.get('stream_load')).toBe(handleStreamLoad);
  });

  it('route/broadcast handlers emit parse and bounds diagnostics', () => {
    const invalidRoute = ctx();
    handleRoute(pragma('route(garbage)'), invalidRoute);
    expect(invalidRoute.generatedCycles).toHaveLength(0);
    expect(invalidRoute.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const oobRoute = ctx();
    handleRoute(pragma('route(@9,0 -> @0,0, payload=R0, accum=R1)'), oobRoute);
    expect(oobRoute.generatedCycles).toHaveLength(0);
    expect(oobRoute.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const invalidBroadcast = ctx();
    handleBroadcast(pragma('broadcast(R0)'), invalidBroadcast);
    expect(invalidBroadcast.generatedCycles).toHaveLength(0);
    expect(invalidBroadcast.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const oobBroadcast = ctx();
    handleBroadcast(pragma('broadcast(value=R1, from=@8,8, to=row)'), oobBroadcast);
    expect(oobBroadcast.generatedCycles).toHaveLength(0);
    expect(oobBroadcast.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('route/broadcast handlers append generated cycles on valid input', () => {
    const routeContext = ctx();
    handleRoute(pragma('route(@0,1 -> @0,0, payload=R3, accum=R1)'), routeContext);
    expect(routeContext.diagnostics).toHaveLength(0);
    expect(routeContext.generatedCycles.length).toBeGreaterThan(0);

    const broadcastContext = ctx();
    handleBroadcast(pragma('broadcast(value=R1, from=@0,0, to=all)'), broadcastContext);
    expect(broadcastContext.diagnostics).toHaveLength(0);
    expect(broadcastContext.generatedCycles.length).toBeGreaterThan(0);
  });

  it('rotate/shift handlers cover syntax, topology and stream parsing paths', () => {
    const badRotate = ctx();
    handleRotateShift(pragma('rotate(nope)'), badRotate);
    expect(badRotate.generatedCycles).toHaveLength(0);
    expect(badRotate.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const rotateOnMesh = ctx(meshGrid);
    handleRotateShift(pragma('rotate(reg=R0, direction=left, distance=1)'), rotateOnMesh);
    expect(rotateOnMesh.generatedCycles).toHaveLength(0);
    expect(rotateOnMesh.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const shiftOk = ctx(meshGrid);
    handleRotateShift(pragma('shift(reg=R0, direction=right, distance=2, fill=7)'), shiftOk);
    expect(shiftOk.diagnostics).toHaveLength(0);
    expect(shiftOk.generatedCycles).toHaveLength(4);

    const badStreamLoad = ctx();
    handleStreamLoad(pragma('stream_load(row=0)'), badStreamLoad);
    expect(badStreamLoad.generatedCycles).toHaveLength(0);
    expect(badStreamLoad.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const badStreamStore = ctx();
    handleStreamStore(pragma('stream_store(count=2)'), badStreamStore);
    expect(badStreamStore.generatedCycles).toHaveLength(0);
    expect(badStreamStore.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const streamOk = ctx();
    handleStreamLoad(pragma('stream_load(dest=R1, row=1, count=2)'), streamOk);
    handleStreamStore(pragma('stream_store(src=R1, row=1, count=2)'), streamOk);
    expect(streamOk.diagnostics).toHaveLength(0);
    expect(streamOk.generatedCycles).toHaveLength(4);
  });

  it('collective handlers reject malformed statements', () => {
    const cases: Array<{ fn: Function; text: string }> = [
      { fn: handleReduce, text: 'reduce(nope)' },
      { fn: handleScan, text: 'scan(nope)' },
      { fn: handleStencil, text: 'stencil(nope)' },
      { fn: handleTriangle, text: 'triangle(nope)' },
      { fn: handleAllreduce, text: 'allreduce(nope)' },
      { fn: handleTranspose, text: 'transpose(nope)' },
      { fn: handleGather, text: 'gather(nope)' }
    ];

    for (const entry of cases) {
      const local = ctx();
      entry.fn(pragma(entry.text), local);
      expect(local.generatedCycles).toHaveLength(0);
      expect(local.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    }
  });

  it('collective handlers generate cycles on valid statements', () => {
    const reduceContext = ctx();
    handleReduce(pragma('reduce(op=add, dest=R1, src=R0, axis=row)'), reduceContext);
    expect(reduceContext.diagnostics).toHaveLength(0);
    expect(reduceContext.generatedCycles.length).toBeGreaterThan(0);

    const scanContext = ctx();
    handleScan(pragma('scan(op=add, src=R0, dest=R1, dir=left, mode=inclusive)'), scanContext);
    expect(scanContext.diagnostics).toHaveLength(0);
    expect(scanContext.generatedCycles.length).toBeGreaterThan(0);

    const stencilContext = ctx();
    handleStencil(pragma('stencil(cross, add, R0, R1)'), stencilContext);
    expect(stencilContext.diagnostics).toHaveLength(0);
    expect(stencilContext.generatedCycles.length).toBeGreaterThan(0);

    const triangleContext = ctx();
    handleTriangle(
      pragma('triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1)'),
      triangleContext
    );
    expect(triangleContext.diagnostics).toHaveLength(0);
    expect(triangleContext.generatedCycles.length).toBe(1);
    expect(triangleContext.generatedCycles[0].statements.length).toBe(10);

    const allreduceContext = ctx();
    handleAllreduce(pragma('allreduce(op=add, dest=R1, src=R0, axis=row)'), allreduceContext);
    expect(allreduceContext.diagnostics).toHaveLength(0);
    expect(allreduceContext.generatedCycles.length).toBeGreaterThan(0);

    const transposeContext = ctx();
    handleTranspose(pragma('transpose(reg=R0)'), transposeContext);
    expect(transposeContext.diagnostics).toHaveLength(0);
    expect(transposeContext.generatedCycles.length).toBeGreaterThan(0);

    const gatherContext = ctx();
    handleGather(pragma('gather(src=R0, dest=@0,0, destReg=R1, op=add)'), gatherContext);
    expect(gatherContext.diagnostics).toHaveLength(0);
    expect(gatherContext.generatedCycles.length).toBeGreaterThan(0);
  });
});
