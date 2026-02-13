# Scheduler Modes

`schedulerMode` controls deterministic scheduling strategy in the compiler API.
`slot-pack` is active in all modes and uses a mode-specific default window.

## API Usage

```ts
import { compile } from '@openedge/compiler-api';

const source = `
target "uma-cgra-base";
kernel "sched_demo" {
  cycle { at @0,0: SADD R1, R0, 1; }
  cycle { at @0,1: SADD R2, R0, 1; }
}
`;

const safe = compile(source, { schedulerMode: 'safe' });
const balanced = compile(source, { schedulerMode: 'balanced' });
const aggressive = compile(source, { schedulerMode: 'aggressive' });

const tunedSafe = compile(source, {
  schedulerMode: 'safe',
  schedulerWindow: 2,
  memoryReorderPolicy: 'strict'
});

console.log(safe.stats.cycles, balanced.stats.cycles, aggressive.stats.cycles);
```

## Determinism Contract

- same source + same `schedulerMode` => same emitted CSV.
- same source + same `schedulerMode` + same scheduler options => same emitted CSV.
- `safe` defaults to `schedulerWindow=1` and `memoryReorderPolicy="strict"`.
- `balanced` defaults to `schedulerWindow=2` and `memoryReorderPolicy="same-address-fence"`.
- `aggressive` defaults to `schedulerWindow=4` and `memoryReorderPolicy="same-address-fence"`.
- `schedulerWindow` can be overridden (`>=0` integer).
- `memoryReorderPolicy` can be overridden:
  - `"strict"`: memory ops stay pinned; ALU-only placements may still compact across memory cycles when legal.
  - `"same-address-fence"`: allows more compaction while fencing same-address memory interactions.

## DSL Example used by all modes

```openedge
target "uma-cgra-base";
kernel "sched_demo" {
  cycle { at @0,0: SADD R1, R0, 1; }
  cycle { at @0,1: SADD R2, R0, 1; }
}
```
