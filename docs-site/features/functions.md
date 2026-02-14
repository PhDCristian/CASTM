# Functions

Functions are first-class canonical blocks and can be invoked from kernels.

## Function Definition

```text
function stage(dst, src) {
  cycle { at @0,0: dst = src >> 16; }
}
```

## Calling Functions

```openedge
target "uma-cgra-base";

function load(src) {
  cycle { at @0,0: SADD R2, src, ZERO; }
}

function mix(dst) {
  cycle { at @0,1: SADD dst, R2, ZERO; }
}

kernel "functions" {
  load(R0);
  mix(R3);
}
```

## Pipeline Macro

You can sequence function calls explicitly:

```openedge
target "uma-cgra-base";

function stage_load(src) {
  cycle { @0,0: SADD R2, src, ZERO; }
}

function stage_mix(dst) {
  cycle { @0,1: SADD dst, R2, ZERO; }
}

kernel "pipeline_calls" {
  pipeline(stage_load(R0), stage_mix(R3));
}
```

Function expansion is deterministic and preserves call-site order.


## OpenEdgeDSL ↔ CSV

::: code-group
<<< ../snippets/features/functions/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/functions/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/functions/01-main.csv`.
