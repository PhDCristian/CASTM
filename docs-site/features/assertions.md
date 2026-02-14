# Runtime Directives

OpenEdgeDSL supports runtime directives inside kernels for IO pointers, limits, and assertions.

## Supported Directives

- `.io_load <addr0>, <addr1>, ...`
- `.io_store <addr0>, <addr1>, ...`
- `.limit <max_cycles>`
- `.assert <expr>`

## Executable Snippet

```openedge
target "uma-cgra-base";
kernel "runtime_directives" {
  .io_load 0, 4, 8
  .io_store 16, 20
  .limit 64
  .assert cycle=0 @0,0 R0 == 0

  cycle { at @0,0: NOP; }
}
```

Runtime directives are collected as compile artifacts and consumed by execution wrappers.


## OpenEdgeDSL ↔ CSV

::: code-group
<<< ../snippets/features/assertions/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/assertions/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/assertions/01-main.csv`.
