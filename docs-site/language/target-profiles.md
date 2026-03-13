# Target Profiles

`target` defines the hardware profile used by semantic checks and lowering defaults.

## Why `target` exists

The compiler needs a target profile to resolve:

- default grid (`rows`, `cols`, `topology`, `wrapPolicy`)
- valid registers
- valid neighbor inputs
- routing semantics tied to topology

## Canonical syntax

`target` accepts either an alias or a concrete profile ID.

```castm
target base;
kernel "alias_target" {
  bundle { at @0,0: SADD R1, R0, 1; }
}
```

```castm
target "uma-cgra-base";
kernel "id_target" {
  bundle { at @0,0: SADD R1, R0, 1; }
}
```

## Built-in aliases

| Alias | Resolved ID |
|---|---|
| `base` | `uma-cgra-base` |
| `mesh` | `uma-cgra-mesh` |

Canonical docs use `target base;`.

## What `base` contains

Current catalog entry (`packages/lang-spec/src/target-profiles.json`):

| Field | Value |
|---|---|
| `id` | `uma-cgra-base` |
| `description` | UMA CGRA baseline profile |
| `grid.rows` / `grid.cols` | `4` / `4` |
| `grid.topology` | `torus` |
| `grid.wrapPolicy` | `wrap` |
| `registers` | `R0, R1, R2, R3, ROUT, ZERO` |
| `neighbors` | `SELF, RCL, RCR, RCT, RCB, PREV` |

## `target` + `build` interaction

`target` sets defaults.  
`build { ... }` can override selected defaults (for example grid dimensions/topology).

```castm
target base;
build {
  optimize O2;
  grid 8x8 mesh;
}
kernel "override_grid" {
  bundle { at @0,0: SADD R1, R0, 1; }
}
```

## How to create a new target profile

This is a maintainer/contributor workflow.

1. Add a new entry in:
   - `packages/lang-spec/src/target-profiles.json`
2. (Optional) Add a friendly alias in:
   - `packages/lang-spec/src/index.ts` (`TARGET_ALIASES`)
3. Regenerate generated reference docs:
   - `npm run docs:generate`
4. Add/adjust tests for profile resolution and grid validation.

Example profile shape:

```json
{
  "id": "uma-cgra-custom",
  "description": "Custom profile",
  "grid": { "rows": 6, "cols": 6, "topology": "mesh", "wrapPolicy": "clamp" },
  "registers": ["R0", "R1", "R2", "R3", "ROUT", "ZERO"],
  "neighbors": ["SELF", "RCL", "RCR", "RCT", "RCB", "PREV"]
}
```

## Diagnostics

If target resolution fails:

- `E2001` missing target declaration
- `E3006` unknown target profile

## Related

- [Configuration in Source](/language/configuration)
- [Program Structure](/language/program-structure)
- [Instruction Set](/language/instruction-set)
