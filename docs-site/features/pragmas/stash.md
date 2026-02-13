# `std::stash(...)`

Explicit deterministic spill/restore placement using `SWI/LWI`.

## Syntax

```text
std::stash(action=save|restore, reg=R0, addr=<memory-or-address>[, target=all|row(N)|col(N)|point(r,c)]);
```

## Options

| Key | Required | Description |
|---|---|---|
| `action` | yes | `save` (`SWI`) or `restore` (`LWI`) |
| `reg` | yes | register to spill/restore |
| `addr` | yes | memory symbol or raw address expression |
| `target` | no | spatial target (`all` default) |

## Semantics

- `save` emits `SWI reg, addr`
- `restore` emits `LWI reg, addr`
- target expands to placements over selected region

## Executable Example

```openedge
target "uma-cgra-base";
let L @360 = { 0, 0, 0, 0 };

kernel "stash_doc" {
  std::stash(action=save, reg=R0, addr=L[0], target=point(3,0));
  std::stash(action=restore, reg=R1, addr=L[0], target=point(3,0));
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
"SWI R0, L[0]",NOP,NOP,NOP
1,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
"LWI R1, L[0]",NOP,NOP,NOP
```
