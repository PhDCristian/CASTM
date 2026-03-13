# Runtime Statements

CASTM supports typed runtime statements inside kernels for IO pointers, limits, and assertions.

## Supported Statements

- `io.load(<addr0>, <addr1>, ...)`
- `io.store(<addr0>, <addr1>, ...)`
- `limit(<max_cycles>)`
- `assert(at=@r,c, reg=R0, equals=0, cycle=0)`

## Executable Snippet

```castm
target base;
kernel "runtime_directives" {
  io.load(0, 4, 8);
  io.store(16, 20);
  limit(64);
  assert(at=@0,0, reg=R0, equals=0, cycle=0);

  bundle { at @0,0: SADD R0, R0, 1; }
}
```

Runtime directives are collected as compile artifacts and consumed by execution wrappers.


## CASTM ↔ CSV

::: code-group
<<< ../snippets/features/assertions/01-main.castm{castm} [CASTM]
<<< ../snippets/features/assertions/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/assertions/01-main.csv`.
