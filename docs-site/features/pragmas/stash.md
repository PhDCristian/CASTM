# `stash(...)`

Explicit deterministic spill/restore placement using `SWI/LWI`.

## Syntax

```text
stash(action=save|restore, reg=R0, addr=<memory-or-address>[, target=all|row(N)|col(N)|point(r,c)]);
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
  stash(action=save, reg=R0, addr=L[0], target=point(3,0));
  stash(action=restore, reg=R1, addr=L[0], target=point(3,0));
}
```
