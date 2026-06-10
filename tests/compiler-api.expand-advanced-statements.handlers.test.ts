import { describe, expect, it } from 'vitest';
import {
  ErrorCodes,
  spanAt
} from '@castm/compiler-ir';
import {
  handleBroadcast,
  handleRoute
} from '../packages/compiler-api/src/passes-shared/expand-advanced-statements/handlers-route-broadcast.js';
import {
  handleRotateShift,
  handleStreamLoad,
  handleStreamStore
} from '../packages/compiler-api/src/passes-shared/expand-advanced-statements/handlers-rotate-stream.js';
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
} from '../packages/compiler-api/src/passes-shared/expand-advanced-statements/handlers-collective.js';
import {
  NOOP_ADVANCED_STATEMENTS,
  PRAGMA_HANDLERS,
  SUPPORTED_ADVANCED_STATEMENTS
} from '../packages/compiler-api/src/passes-shared/expand-advanced-statements/registry.js';

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
    generatedBundles: [] as any[],
    diagnostics: [] as any[]
  };
}

function advancedStatement(text: string) {
  return { text, span };
}

describe('compiler-api expand-advanced-statements handlers/registry', () => {
  it('exposes supported and noop advancedStatement registries', () => {
    expect(NOOP_ADVANCED_STATEMENTS.has('unroll')).toBe(true);
    expect(NOOP_ADVANCED_STATEMENTS.has('route')).toBe(false);
    expect(NOOP_ADVANCED_STATEMENTS.has('latency_hide')).toBe(true);

    expect(SUPPORTED_ADVANCED_STATEMENTS.has('route')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('stream_store')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('collect')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('accumulate')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('mulacc_chain')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('carry_chain')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('conditional_sub')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('extract_bytes')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('normalize')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('guard')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('stash')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('triangle')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('latency_hide')).toBe(true);
    expect(SUPPORTED_ADVANCED_STATEMENTS.has('unknown')).toBe(false);

    expect(PRAGMA_HANDLERS.get('route')).toBe(handleRoute);
    expect(PRAGMA_HANDLERS.get('broadcast')).toBe(handleBroadcast);
    expect(PRAGMA_HANDLERS.get('accumulate')).toBe(handleAccumulate);
    expect(PRAGMA_HANDLERS.get('mulacc_chain')).toBe(handleMulaccChain);
    expect(PRAGMA_HANDLERS.get('carry_chain')).toBe(handleCarryChain);
    expect(PRAGMA_HANDLERS.get('conditional_sub')).toBe(handleConditionalSub);
    expect(PRAGMA_HANDLERS.get('collect')).toBe(handleCollect);
    expect(PRAGMA_HANDLERS.get('extract_bytes')).toBe(handleExtractBytes);
    expect(PRAGMA_HANDLERS.get('stash')).toBe(handleStash);
    expect(PRAGMA_HANDLERS.get('normalize')).toBe(handleNormalize);
    expect(PRAGMA_HANDLERS.get('guard')).toBe(handleGuard);
    expect(PRAGMA_HANDLERS.has('latency_hide')).toBe(false);
    expect(PRAGMA_HANDLERS.get('rotate')).toBe(handleRotateShift);
    expect(PRAGMA_HANDLERS.get('stream_load')).toBe(handleStreamLoad);
  });

  it('route/broadcast handlers emit parse and bounds diagnostics', () => {
    const invalidRoute = ctx();
    handleRoute(advancedStatement('route(garbage)'), invalidRoute);
    expect(invalidRoute.generatedBundles).toHaveLength(0);
    expect(invalidRoute.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const oobRoute = ctx();
    handleRoute(advancedStatement('route(@9,0 -> @0,0, payload=R0, accum=R1)'), oobRoute);
    expect(oobRoute.generatedBundles).toHaveLength(0);
    expect(oobRoute.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const invalidBroadcast = ctx();
    handleBroadcast(advancedStatement('broadcast(R0)'), invalidBroadcast);
    expect(invalidBroadcast.generatedBundles).toHaveLength(0);
    expect(invalidBroadcast.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const oobBroadcast = ctx();
    handleBroadcast(advancedStatement('broadcast(value=R1, from=@8,8, to=row)'), oobBroadcast);
    expect(oobBroadcast.generatedBundles).toHaveLength(0);
    expect(oobBroadcast.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('route/broadcast handlers append generated bundles on valid input', () => {
    const routeContext = ctx();
    handleRoute(advancedStatement('route(@0,1 -> @0,0, payload=R3, accum=R1)'), routeContext);
    expect(routeContext.diagnostics).toHaveLength(0);
    expect(routeContext.generatedBundles.length).toBeGreaterThan(0);

    const broadcastContext = ctx();
    handleBroadcast(advancedStatement('broadcast(value=R1, from=@0,0, to=all)'), broadcastContext);
    expect(broadcastContext.diagnostics).toHaveLength(0);
    expect(broadcastContext.generatedBundles.length).toBeGreaterThan(0);
  });

  it('rotate/shift handlers cover syntax, topology and stream parsing paths', () => {
    const badRotate = ctx();
    handleRotateShift(advancedStatement('rotate(nope)'), badRotate);
    expect(badRotate.generatedBundles).toHaveLength(0);
    expect(badRotate.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const rotateOnMesh = ctx(meshGrid);
    handleRotateShift(advancedStatement('rotate(reg=R0, direction=left, distance=1)'), rotateOnMesh);
    expect(rotateOnMesh.generatedBundles).toHaveLength(0);
    expect(rotateOnMesh.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const shiftOk = ctx(meshGrid);
    handleRotateShift(advancedStatement('shift(reg=R0, direction=right, distance=2, fill=7)'), shiftOk);
    expect(shiftOk.diagnostics).toHaveLength(0);
    expect(shiftOk.generatedBundles).toHaveLength(4);

    const badStreamLoad = ctx();
    handleStreamLoad(advancedStatement('stream_load(row=0)'), badStreamLoad);
    expect(badStreamLoad.generatedBundles).toHaveLength(0);
    expect(badStreamLoad.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const badStreamStore = ctx();
    handleStreamStore(advancedStatement('stream_store(count=2)'), badStreamStore);
    expect(badStreamStore.generatedBundles).toHaveLength(0);
    expect(badStreamStore.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const streamOk = ctx();
    handleStreamLoad(advancedStatement('stream_load(dest=R1, row=1, count=2)'), streamOk);
    handleStreamStore(advancedStatement('stream_store(src=R1, row=1, count=2)'), streamOk);
    expect(streamOk.diagnostics).toHaveLength(0);
    expect(streamOk.generatedBundles).toHaveLength(4);
  });

  it('collective handlers reject malformed statements', () => {
    const cases: Array<{ fn: Function; text: string }> = [
      { fn: handleReduce, text: 'reduce(nope)' },
      { fn: handleScan, text: 'scan(nope)' },
      { fn: handleStencil, text: 'stencil(nope)' },
      { fn: handleAccumulate, text: 'accumulate(nope)' },
      { fn: handleMulaccChain, text: 'mulacc_chain(nope)' },
      { fn: handleCarryChain, text: 'carry_chain(nope)' },
      { fn: handleCollect, text: 'collect(nope)' },
      { fn: handleStash, text: 'stash(nope)' },
      { fn: handleConditionalSub, text: 'conditional_sub(nope)' },
      { fn: handleExtractBytes, text: 'extract_bytes(nope)' },
      { fn: handleNormalize, text: 'normalize(nope)' },
      { fn: handleGuard, text: 'guard(nope)' },
      { fn: handleTriangle, text: 'triangle(nope)' },
      { fn: handleAllreduce, text: 'allreduce(nope)' },
      { fn: handleTranspose, text: 'transpose(nope)' },
      { fn: handleGather, text: 'gather(nope)' }
    ];

    for (const entry of cases) {
      const local = ctx();
      entry.fn(advancedStatement(entry.text), local);
      expect(local.generatedBundles).toHaveLength(0);
      expect(local.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    }
  });

  it('collective handlers generate bundles on valid statements', () => {
    const reduceContext = ctx();
    handleReduce(advancedStatement('reduce(op=add, dest=R1, src=R0, axis=row)'), reduceContext);
    expect(reduceContext.diagnostics).toHaveLength(0);
    expect(reduceContext.generatedBundles.length).toBeGreaterThan(0);

    const scanContext = ctx();
    handleScan(advancedStatement('scan(op=add, src=R0, dest=R1, dir=left, mode=inclusive)'), scanContext);
    expect(scanContext.diagnostics).toHaveLength(0);
    expect(scanContext.generatedBundles.length).toBeGreaterThan(0);

    const stencilContext = ctx();
    handleStencil(advancedStatement('stencil(cross, add, R0, R1)'), stencilContext);
    expect(stencilContext.diagnostics).toHaveLength(0);
    expect(stencilContext.generatedBundles.length).toBeGreaterThan(0);

    const collectContext = ctx();
    handleCollect(
      advancedStatement('collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add)'),
      collectContext
    );
    expect(collectContext.diagnostics).toHaveLength(0);
    expect(collectContext.generatedBundles.length).toBe(2);

    const stashContext = ctx();
    handleStash(
      advancedStatement('stash(action=save, reg=R0, addr=L[0], target=point(3,0))'),
      stashContext
    );
    expect(stashContext.diagnostics).toHaveLength(0);
    expect(stashContext.generatedBundles.length).toBe(1);

    const conditionalSubContext = ctx();
    handleConditionalSub(
      advancedStatement('conditional_sub(value=R0, sub=R1, dest=R2, target=row(1))'),
      conditionalSubContext
    );
    expect(conditionalSubContext.diagnostics).toHaveLength(0);
    expect(conditionalSubContext.generatedBundles.length).toBe(2);

    const carryChainContext = ctx();
    handleCarryChain(
      advancedStatement('carry_chain(src=R0, carry=R3, store=L, limbs=2, width=16, row=0, start=0, dir=right)'),
      carryChainContext
    );
    expect(carryChainContext.diagnostics).toHaveLength(0);
    expect(carryChainContext.generatedBundles.length).toBe(8);

    const accumulateContext = ctx();
    handleAccumulate(
      advancedStatement('accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add)'),
      accumulateContext
    );
    expect(accumulateContext.diagnostics).toHaveLength(0);
    expect(accumulateContext.generatedBundles.length).toBe(4);

    const mulaccContext = ctx();
    handleMulaccChain(
      advancedStatement('mulacc_chain(src=R0, coeff=R1, acc=R3, out=R2, target=row(0), lanes=4, width=16, dir=right)'),
      mulaccContext
    );
    expect(mulaccContext.diagnostics).toHaveLength(0);
    expect(mulaccContext.generatedBundles.length).toBe(4);

    const normalizeContext = ctx();
    handleNormalize(
      advancedStatement('normalize(reg=R3, carry=R1, width=16, lane=0, axis=row, dir=right)'),
      normalizeContext
    );
    expect(normalizeContext.diagnostics).toHaveLength(0);
    expect(normalizeContext.generatedBundles.length).toBe(4);

    const extractContext = ctx();
    handleExtractBytes(
      advancedStatement('extract_bytes(src=R0, dest=R1, axis=col, byteWidth=8, mask=255)'),
      extractContext
    );
    expect(extractContext.diagnostics).toHaveLength(0);
    expect(extractContext.generatedBundles.length).toBe(2);

    const triangleContext = ctx();
    handleTriangle(
      advancedStatement('triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1)'),
      triangleContext
    );
    expect(triangleContext.diagnostics).toHaveLength(0);
    expect(triangleContext.generatedBundles.length).toBe(1);
    expect(triangleContext.generatedBundles[0].statements.length).toBe(10);

    const guardContext = ctx();
    handleGuard(
      advancedStatement('guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1)'),
      guardContext
    );
    expect(guardContext.diagnostics).toHaveLength(0);
    expect(guardContext.generatedBundles.length).toBe(1);
    expect(guardContext.generatedBundles[0].statements.length).toBe(10);

    const allreduceContext = ctx();
    handleAllreduce(advancedStatement('allreduce(op=add, dest=R1, src=R0, axis=row)'), allreduceContext);
    expect(allreduceContext.diagnostics).toHaveLength(0);
    expect(allreduceContext.generatedBundles.length).toBeGreaterThan(0);

    const transposeContext = ctx();
    handleTranspose(advancedStatement('transpose(reg=R0)'), transposeContext);
    expect(transposeContext.diagnostics).toHaveLength(0);
    expect(transposeContext.generatedBundles.length).toBeGreaterThan(0);

    const gatherContext = ctx();
    handleGather(advancedStatement('gather(src=R0, dest=@0,0, destReg=R1, op=add)'), gatherContext);
    expect(gatherContext.diagnostics).toHaveLength(0);
    expect(gatherContext.generatedBundles.length).toBeGreaterThan(0);
  });
});
