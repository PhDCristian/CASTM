# Scheduler Practical Cases

This page shows practical, measurable scheduler behavior with canonical DSL.

## OpenEdgeDSL / CSV

::: code-group
<<< ./artifacts/scheduler-practical.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/scheduler-practical.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Case 1: Window compaction really reduces cycles

Source:

```openedge
target "uma-cgra-base";
kernel "window_demo" {
  cycle { at @0,0: SADD R1, R0, 1; }
  cycle { at @0,1: SADD R2, R0, 1; }
  cycle { at @0,2: SADD R3, R0, 1; }
}
```

Measured with `compile(...).stats.cycles`:

- `schedulerWindow=0` -> `3` cycles
- `schedulerWindow=1` -> `2` cycles
- `schedulerWindow=2` -> `1` cycle

Why it compacts:

- no PE collisions,
- no control-flow barriers,
- no memory ops,
- no route-hop dependencies.

## Case 2: Numeric branch targets are remapped after compaction

Source:

```openedge
target "uma-cgra-base";
kernel "branch_remap" {
  cycle { at @0,0: BEQ R0, 0, 3; }
  cycle { at @0,0: NOP; }
  cycle { at @0,1: SADD R2, R3, ZERO; }
  cycle { at @0,0: BNE R1, 0, 0; }
}
```

Measured:

- baseline (`schedulerWindow=0`): `4` cycles, branch row `BEQ R0 0 3`
- packed (`schedulerWindow=1`): `3` cycles, branch row `BEQ R0 0 2`

Practical impact:

- noop cycles can be removed safely,
- numeric branch destinations are updated deterministically to keep control-flow correct.

## Case 3: `ROUT` writer movement in non-strict policy

Source:

```openedge
target "uma-cgra-base";
kernel "route_move" {
  cycle { at @0,0: SADD R1, R0, 1; }
  cycle { at @0,1: SADD ROUT, R2, ZERO; }
}
```

Measured:

- `memoryReorderPolicy="strict"` -> `2` cycles
- `memoryReorderPolicy="same-address-fence"` -> `1` cycle

Safety rule:

- `ROUT` producers may move earlier only if they do not cross incoming-read placements (`RCL`, `RCR`, `RCT`, `RCB`, `INCOMING`).

## Real kernel check (SBOX K7 v10)

For real workload context, current SBOX kernels remain:

- `safe`: `205` cycles
- `balanced`: `205` cycles
- `aggressive`: `205` cycles

This means scheduler legality is preserved, but the current bottleneck is algorithmic dependency structure (`compute_qhat` / `mul_qhat_p`), not simple slot packing.

## Reproduction script

```ts
import { compile } from '@openedge/compiler-api';

const source = `target "uma-cgra-base"; kernel "k" { cycle { at @0,0: NOP; } }`;
const result = compile(source, {
  schedulerMode: 'safe',
  schedulerWindow: 1,
  memoryReorderPolicy: 'strict'
});

console.log(result.stats.cycles, result.stats.schedulerMode);
```

Full generated CSV: `docs-site/examples/artifacts/scheduler-practical.csv`.
