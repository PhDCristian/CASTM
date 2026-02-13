# Scheduler Modes

`schedulerMode` controls deterministic scheduling strategy in the compiler API.

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

console.log(safe.stats.cycles, balanced.stats.cycles, aggressive.stats.cycles);
```

## Determinism Contract

- same source + same `schedulerMode` => same emitted CSV.
- `safe` keeps conservative behavior.
- `balanced` and `aggressive` apply deterministic legal compaction strategies.

## DSL Example used by all modes

```openedge
target "uma-cgra-base";
kernel "sched_demo" {
  cycle { at @0,0: SADD R1, R0, 1; }
  cycle { at @0,1: SADD R2, R0, 1; }
}
```
