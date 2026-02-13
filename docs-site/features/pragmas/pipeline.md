# `pipeline(...)`

Ordered function-call sequencing macro for stage composition.

## Syntax

```text
pipeline(step0(), step1(arg0), step2(arg0, arg1), ...);
```

## Rules

- each entry must be a function call
- entries expand left-to-right
- expansion keeps call-site order deterministic

## DSL to CSV Example (Matrix)

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";

function stage_load(src) {
  cycle { @0,0: SADD R2, src, ZERO; }
}

function stage_mix(dst) {
  cycle { @0,1: SADD dst, R2, ZERO; }
}

kernel "pipeline_doc" {
  std::pipeline(stage_load(R0), stage_mix(R3));
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R2, R0, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
NOP,"SADD R3, R2, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
:::
