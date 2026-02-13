# Pipeline Statement (`pipeline(...)`)

`pipeline(...)` is a canonical macro statement that expands into an ordered sequence of canonical function calls.

## Canonical Syntax

```text
pipeline(step0(), step1(arg0), step2(arg0, arg1), ...);
```

Rules:

- each entry must be a function call expression.
- entries are expanded left-to-right.
- advanced statements (`std::route(...)`, `std::reduce(...)`, etc.) are not valid as pipeline entries.

## Semantics

`pipeline(a(), b(x), c(y,z));` is expanded as if you had written:

```text
a();
b(x);
c(y,z);
```

Expansion happens before function-body lowering, so label hygiene and existing function expansion rules remain unchanged.

## Example

```dsl
target "uma-cgra-base";

function stage_load(src) {
  cycle { @0,0: SADD R2, src, ZERO; }
}

function stage_mix(dst) {
  cycle { @0,1: SADD dst, R2, ZERO; }
}

kernel "pipeline_doc" {
  pipeline(stage_load(R0), stage_mix(R3));
}
```

## Diagnostics

- empty `pipeline()` is rejected.
- non-call entries are rejected.
- entries using reserved/advanced names are rejected.

## Verification

Executable contract tests:

- `tests/issues/feat-16-pipeline.test.ts`
- `tests/compiler-front.parser-modules.test.ts`
